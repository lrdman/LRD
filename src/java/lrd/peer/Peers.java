/******************************************************************************
 * Copyright © 2013-2015 The Nxt Core Developers.                             *
 *                                                                            *
 * See the AUTHORS.txt, DEVELOPER-AGREEMENT.txt and LICENSE.txt files at      *
 * the top-level directory of this distribution for the individual copyright  *
 * holder information and the developer policies on copyright and licensing.  *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement, no part of the    *
 * Nxt software, including this file, may be copied, modified, propagated,    *
 * or distributed except according to the terms contained in the LICENSE.txt  *
 * file.                                                                      *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

package lrd.peer;

import lrd.Account;
import lrd.Block;
import lrd.Constants;
import lrd.Db;
import lrd.Lrd;
import lrd.Transaction;
import lrd.util.Convert;
import lrd.util.Filter;
import lrd.util.JSON;
import lrd.util.Listener;
import lrd.util.Listeners;
import lrd.util.Logger;
import lrd.util.ThreadPool;
import lrd.util.UPnP;
import org.eclipse.jetty.server.Connector;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.eclipse.jetty.servlet.FilterHolder;
import org.eclipse.jetty.servlet.FilterMapping;
import org.eclipse.jetty.servlet.ServletHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.servlets.DoSFilter;
import org.eclipse.jetty.servlets.GzipFilter;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONStreamAware;

import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public final class Peers {

    public enum Event {
        BLACKLIST, UNBLACKLIST, DEACTIVATE, REMOVE,
        DOWNLOADED_VOLUME, UPLOADED_VOLUME, WEIGHT,
        ADDED_ACTIVE_PEER, CHANGED_ACTIVE_PEER,
        NEW_PEER, ADD_INBOUND, REMOVE_INBOUND
    }

    static final int LOGGING_MASK_EXCEPTIONS = 1;
    static final int LOGGING_MASK_NON200_RESPONSES = 2;
    static final int LOGGING_MASK_200_RESPONSES = 4;
    static volatile int communicationLoggingMask;

    private static final List<String> wellKnownPeers;
    static final Set<String> knownBlacklistedPeers;

    static final int connectTimeout;
    static final int readTimeout;
    static final int blacklistingPeriod;
    static final boolean getMorePeers;
    static final int MAX_REQUEST_SIZE = 1024 * 1024;
    static final int MAX_RESPONSE_SIZE = 1024 * 1024;
    static final boolean useWebSockets;
    static final int webSocketIdleTimeout;
    static final boolean useProxy = System.getProperty("socksProxyHost") != null || System.getProperty("http.proxyHost") != null;

    private static final int DEFAULT_PEER_PORT = 888;
    private static final int TESTNET_PEER_PORT = 777;
    private static final String myPlatform;
    private static final String myAddress;
    private static final int myPeerServerPort;
    private static final String myHallmark;
    private static final boolean shareMyAddress;
    private static final boolean enablePeerUPnP;
    private static final int maxNumberOfInboundConnections;
    private static final int maxNumberOfOutboundConnections;
    public static final int maxNumberOfConnectedPublicPeers;
    private static final int maxNumberOfKnownPeers;
    private static final int minNumberOfKnownPeers;
    private static final boolean enableHallmarkProtection;
    private static final int pushThreshold;
    private static final int pullThreshold;
    private static final int sendToPeersLimit;
    private static final boolean usePeersDb;
    private static final boolean savePeers;
    static final boolean ignorePeerAnnouncedAddress;
    static final boolean cjdnsOnly;
    static final int MAX_VERSION_LENGTH = 10;
    static final int MAX_APPLICATION_LENGTH = 20;
    static final int MAX_PLATFORM_LENGTH = 30;
    static final int MAX_ANNOUNCED_ADDRESS_LENGTH = 100;


    static final JSONStreamAware myPeerInfoRequest;
    static final JSONStreamAware myPeerInfoResponse;

    private static final Listeners<Peer,Event> listeners = new Listeners<>();

    private static final ConcurrentMap<String, PeerImpl> peers = new ConcurrentHashMap<>();
    private static final ConcurrentMap<String, String> selfAnnouncedAddresses = new ConcurrentHashMap<>();

    static final Collection<PeerImpl> allPeers = Collections.unmodifiableCollection(peers.values());

    static final ExecutorService peersService = Executors.newCachedThreadPool();
    private static final ExecutorService sendingService = Executors.newFixedThreadPool(10);

    static {

        myPlatform = Lrd.getStringProperty("lrd.myPlatform");
        if (myPlatform.length() > MAX_PLATFORM_LENGTH) {
            throw new RuntimeException("lrd.myPlatform length exceeds " + MAX_PLATFORM_LENGTH);
        }
        myAddress = Convert.emptyToNull(Lrd.getStringProperty("lrd.myAddress", "").trim());
        if (myAddress != null && myAddress.endsWith(":" + TESTNET_PEER_PORT) && !Constants.isTestnet) {
            throw new RuntimeException("Port " + TESTNET_PEER_PORT + " should only be used for testnet!!!");
        }
        String myHost = null;
        int myPort = -1;
        if (myAddress != null) {
            try {
                URI uri = new URI("http://" + myAddress);
                myHost = uri.getHost();
                myPort = (uri.getPort() == -1 ? Peers.getDefaultPeerPort() : uri.getPort());
                InetAddress[] myAddrs = InetAddress.getAllByName(myHost);
                boolean addrValid = false;
                Enumeration<NetworkInterface> intfs = NetworkInterface.getNetworkInterfaces();
                chkAddr: while (intfs.hasMoreElements()) {
                    NetworkInterface intf = intfs.nextElement();
                    List<InterfaceAddress> intfAddrs = intf.getInterfaceAddresses();
                    for (InterfaceAddress intfAddr: intfAddrs) {
                        InetAddress extAddr = intfAddr.getAddress();
                        for (InetAddress myAddr : myAddrs) {
                            if (extAddr.equals(myAddr)) {
                                addrValid = true;
                                break chkAddr;
                            }
                        }
                    }
                }
                if (!addrValid) {
                    InetAddress extAddr = UPnP.getExternalAddress();
                    if (extAddr != null) {
                        for (InetAddress myAddr : myAddrs) {
                            if (extAddr.equals(myAddr)) {
                                addrValid = true;
                                break;
                            }
                        }
                    }
                }
                if (!addrValid) {
                    Logger.logWarningMessage("Your announced address does not match your external address");
                }
            } catch (SocketException e) {
                Logger.logErrorMessage("Unable to enumerate the network interfaces :" + e.toString());
            } catch (URISyntaxException | UnknownHostException e) {
                Logger.logWarningMessage("Your announced address is not valid: " + e.toString());
            }
        }
        myPeerServerPort = Lrd.getIntProperty("lrd.peerServerPort");
        if (myPeerServerPort == TESTNET_PEER_PORT && !Constants.isTestnet) {
            throw new RuntimeException("Port " + TESTNET_PEER_PORT + " should only be used for testnet!!!");
        }
        shareMyAddress = Lrd.getBooleanProperty("lrd.shareMyAddress") && ! Constants.isOffline;
        enablePeerUPnP = Lrd.getBooleanProperty("lrd.enablePeerUPnP");
        myHallmark = Lrd.getStringProperty("lrd.myHallmark");
        if (Peers.myHallmark != null && Peers.myHallmark.length() > 0) {
            try {
                Hallmark hallmark = Hallmark.parseHallmark(Peers.myHallmark);
                if (!hallmark.isValid()) {
                    throw new RuntimeException("Hallmark is not valid");
                }
                if (myAddress != null) {
                    if (!hallmark.getHost().equals(myHost)) {
                        throw new RuntimeException("Invalid hallmark host");
                    }
                    if (myPort != hallmark.getPort()) {
                        throw new RuntimeException("Invalid hallmark port");
                    }
                }
            } catch (RuntimeException e) {
                Logger.logErrorMessage("Your hallmark is invalid: " + Peers.myHallmark + " for your address: " + myAddress);
                throw new RuntimeException(e.toString(), e);
            }
        }

        JSONObject json = new JSONObject();
        if (myAddress != null) {
            try {
                URI uri = new URI("http://" + myAddress);
                String host = uri.getHost();
                int port = uri.getPort();
                String announcedAddress;
                if (!Constants.isTestnet) {
                    if (port >= 0)
                        announcedAddress = myAddress;
                    else
                        announcedAddress = host + (myPeerServerPort != DEFAULT_PEER_PORT ? ":" + myPeerServerPort : "");
                } else {
                    announcedAddress = host;
                }
                if (announcedAddress == null || announcedAddress.length() > MAX_ANNOUNCED_ADDRESS_LENGTH) {
                    throw new RuntimeException("Invalid announced address length: " + announcedAddress);
                }
                json.put("announcedAddress", announcedAddress);
            } catch (URISyntaxException e) {
                Logger.logMessage("Your announce address is invalid: " + myAddress);
                throw new RuntimeException(e.toString(), e);
            }
        }
        if (Peers.myHallmark != null && Peers.myHallmark.length() > 0) {
            json.put("hallmark", Peers.myHallmark);
        }
        json.put("application", Lrd.APPLICATION);
        json.put("version", Lrd.VERSION);
        json.put("platform", Peers.myPlatform);
        json.put("shareAddress", Peers.shareMyAddress);
        Logger.logDebugMessage("My peer info:\n" + json.toJSONString());
        myPeerInfoResponse = JSON.prepare(json);
        json.put("requestType", "getInfo");
        myPeerInfoRequest = JSON.prepareRequest(json);

        final List<String> defaultPeers = Constants.isTestnet ? Lrd.getStringListProperty("lrd.defaultTestnetPeers")
                : Lrd.getStringListProperty("lrd.defaultPeers");
        wellKnownPeers = Collections.unmodifiableList(Constants.isTestnet ? Lrd.getStringListProperty("lrd.testnetPeers")
                : Lrd.getStringListProperty("lrd.wellKnownPeers"));

        List<String> knownBlacklistedPeersList = Lrd.getStringListProperty("lrd.knownBlacklistedPeers");
        if (knownBlacklistedPeersList.isEmpty()) {
            knownBlacklistedPeers = Collections.emptySet();
        } else {
            knownBlacklistedPeers = Collections.unmodifiableSet(new HashSet<>(knownBlacklistedPeersList));
        }

        maxNumberOfInboundConnections = Lrd.getIntProperty("lrd.maxNumberOfInboundConnections");
        maxNumberOfOutboundConnections = Lrd.getIntProperty("lrd.maxNumberOfOutboundConnections");
        maxNumberOfConnectedPublicPeers = Math.min(Lrd.getIntProperty("lrd.maxNumberOfConnectedPublicPeers"),
                maxNumberOfOutboundConnections);
        maxNumberOfKnownPeers = Lrd.getIntProperty("lrd.maxNumberOfKnownPeers");
        minNumberOfKnownPeers = Lrd.getIntProperty("lrd.minNumberOfKnownPeers");
        connectTimeout = Lrd.getIntProperty("lrd.connectTimeout");
        readTimeout = Lrd.getIntProperty("lrd.readTimeout");
        enableHallmarkProtection = Lrd.getBooleanProperty("lrd.enableHallmarkProtection");
        pushThreshold = Lrd.getIntProperty("lrd.pushThreshold");
        pullThreshold = Lrd.getIntProperty("lrd.pullThreshold");
        useWebSockets = Lrd.getBooleanProperty("lrd.useWebSockets");
        webSocketIdleTimeout = Lrd.getIntProperty("lrd.webSocketIdleTimeout");
        blacklistingPeriod = Lrd.getIntProperty("lrd.blacklistingPeriod") / 1000;
        communicationLoggingMask = Lrd.getIntProperty("lrd.communicationLoggingMask");
        sendToPeersLimit = Lrd.getIntProperty("lrd.sendToPeersLimit");
        usePeersDb = Lrd.getBooleanProperty("lrd.usePeersDb") && ! Constants.isOffline;
        savePeers = usePeersDb && Lrd.getBooleanProperty("lrd.savePeers");
        getMorePeers = Lrd.getBooleanProperty("lrd.getMorePeers");
        cjdnsOnly = Lrd.getBooleanProperty("lrd.cjdnsOnly");
        ignorePeerAnnouncedAddress = Lrd.getBooleanProperty("lrd.ignorePeerAnnouncedAddress");
        if (useWebSockets && useProxy) {
            Logger.logMessage("Using a proxy, will not create outbound websockets.");
        }

        final List<Future<String>> unresolvedPeers = Collections.synchronizedList(new ArrayList<>());

        if (!Constants.isOffline) {
            ThreadPool.runBeforeStart(new Runnable() {

                private void loadPeers(Collection<String> addresses) {
                    int now = Lrd.getEpochTime();
                    for (final String address : addresses) {
                        Future<String> unresolvedAddress = peersService.submit(() -> {
                            PeerImpl peer = Peers.findOrCreatePeer(address, true);
                            if (peer != null) {
                                peer.setLastUpdated(now);
                                Peers.addPeer(peer);
                                return null;
                            }
                            return address;
                        });
                        unresolvedPeers.add(unresolvedAddress);
                    }
                }

                @Override
                public void run() {
                    loadPeers(wellKnownPeers);
                    if (usePeersDb) {
                        Logger.logDebugMessage("Loading known peers from the database...");
                        loadPeers(defaultPeers);
                        if (savePeers) {
                            List<PeerDb.Entry> dbPeers = PeerDb.loadPeers();
                            for (PeerDb.Entry dbPeer : dbPeers) {
                                Future<String> unresolvedAddress = peersService.submit(() -> {
                                    PeerImpl peer = Peers.findOrCreatePeer(dbPeer.getAddress(), true);
                                    if (peer != null) {
                                        if (peer.getLastUpdated() == 0)
                                            peer.setLastUpdated(dbPeer.getLastUpdated());
                                        Peers.addPeer(peer);
                                        return null;
                                    }
                                    return dbPeer.getAddress();
                                });
                                unresolvedPeers.add(unresolvedAddress);
                            }
                        }
                    }
                }
            }, false);
        }

        ThreadPool.runAfterStart(() -> {
            for (Future<String> unresolvedPeer : unresolvedPeers) {
                try {
                    String badAddress = unresolvedPeer.get(5, TimeUnit.SECONDS);
                    if (badAddress != null) {
                        Logger.logDebugMessage("Failed to resolve peer address: " + badAddress);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (ExecutionException e) {
                    Logger.logDebugMessage("Failed to add peer", e);
                } catch (TimeoutException e) {
                }
            }
            Logger.logDebugMessage("Known peers: " + peers.size());
        });

    }

    private static class Init {

        private final static Server peerServer;

        static {
            if (Peers.shareMyAddress) {
                peerServer = new Server();
                ServerConnector connector = new ServerConnector(peerServer);
                final int port = Constants.isTestnet ? TESTNET_PEER_PORT : Peers.myPeerServerPort;
                connector.setPort(port);
                final String host = Lrd.getStringProperty("lrd.peerServerHost");
                connector.setHost(host);
                connector.setIdleTimeout(Lrd.getIntProperty("lrd.peerServerIdleTimeout"));
                connector.setReuseAddress(true);
                peerServer.addConnector(connector);

                ServletHolder peerServletHolder = new ServletHolder(new PeerServlet());
                boolean isGzipEnabled = Lrd.getBooleanProperty("lrd.enablePeerServerGZIPFilter");
                peerServletHolder.setInitParameter("isGzipEnabled", Boolean.toString(isGzipEnabled));
                ServletHandler peerHandler = new ServletHandler();
                peerHandler.addServletWithMapping(peerServletHolder, "/*");
                if (Lrd.getBooleanProperty("lrd.enablePeerServerDoSFilter")) {
                    FilterHolder dosFilterHolder = peerHandler.addFilterWithMapping(DoSFilter.class, "/*", FilterMapping.DEFAULT);
                    dosFilterHolder.setInitParameter("maxRequestsPerSec", Lrd.getStringProperty("lrd.peerServerDoSFilter.maxRequestsPerSec"));
                    dosFilterHolder.setInitParameter("delayMs", Lrd.getStringProperty("lrd.peerServerDoSFilter.delayMs"));
                    dosFilterHolder.setInitParameter("maxRequestMs", Lrd.getStringProperty("lrd.peerServerDoSFilter.maxRequestMs"));
                    dosFilterHolder.setInitParameter("trackSessions", "false");
                    dosFilterHolder.setAsyncSupported(true);
                }
                if (isGzipEnabled) {
                    FilterHolder gzipFilterHolder = peerHandler.addFilterWithMapping(GzipFilter.class, "/*", FilterMapping.DEFAULT);
                    gzipFilterHolder.setInitParameter("methods", "GET,POST");
                    gzipFilterHolder.setAsyncSupported(true);
                }

                peerServer.setHandler(peerHandler);
                peerServer.setStopAtShutdown(true);
                ThreadPool.runBeforeStart(() -> {
                    try {
                        if (enablePeerUPnP) {
                            Connector[] peerConnectors = peerServer.getConnectors();
                            for (Connector peerConnector : peerConnectors) {
                                if (peerConnector instanceof ServerConnector)
                                    UPnP.addPort(((ServerConnector)peerConnector).getPort());
                            }
                        }
                        peerServer.start();
                        Logger.logMessage("Started peer networking server at " + host + ":" + port);
                    } catch (Exception e) {
                        Logger.logErrorMessage("Failed to start peer networking server", e);
                        throw new RuntimeException(e.toString(), e);
                    }
                }, true);
            } else {
                peerServer = null;
                Logger.logMessage("shareMyAddress is disabled, will not start peer networking server");
            }
        }

        private static void init() {}

        private Init() {}

    }

    private static final Runnable peerUnBlacklistingThread = () -> {

        try {
            try {

                int curTime = Lrd.getEpochTime();
                for (PeerImpl peer : peers.values()) {
                    peer.updateBlacklistedStatus(curTime);
                }

            } catch (Exception e) {
                Logger.logDebugMessage("Error un-blacklisting peer", e);
            }
        } catch (Throwable t) {
            Logger.logErrorMessage("CRITICAL ERROR. PLEASE REPORT TO THE DEVELOPERS.\n" + t.toString());
            t.printStackTrace();
            System.exit(1);
        }

    };

    private static final Runnable peerConnectingThread = new Runnable() {

        @Override
        public void run() {

            try {
                try {

                    final int now = Lrd.getEpochTime();
                    if (!hasEnoughConnectedPublicPeers(Peers.maxNumberOfConnectedPublicPeers)) {
                        List<Future> futures = new ArrayList<>();
                        for (int i = 0; i < 10; i++) {
                            futures.add(peersService.submit(() -> {
                                PeerImpl peer = (PeerImpl) getAnyPeer(ThreadLocalRandom.current().nextInt(2) == 0 ? Peer.State.NON_CONNECTED : Peer.State.DISCONNECTED, false);
                                if (peer != null &&
                                            now - peer.getLastConnectAttempt() > 600 &&
                                            (!enableHallmarkProtection || peer.getVersion() == null || peer.getWeight() > 0)) {
                                    peer.connect();
                                    if (peer.getState() == Peer.State.CONNECTED &&
                                            enableHallmarkProtection && peer.getWeight() == 0 &&
                                            hasTooManyOutboundConnections()) {
                                        Logger.logDebugMessage("Too many outbound connections, deactivating peer " + peer.getHost());
                                        peer.deactivate();
                                    }
                                }
                            }));
                        }
                        for (Future future : futures) {
                            future.get();
                        }
                    }

                    peers.values().forEach(peer -> {
                        if (peer.getState() == Peer.State.CONNECTED
                                && now - peer.getLastUpdated() > 3600
                                && now - peer.getLastConnectAttempt() > 600) {
                            peersService.submit(peer::connect);
                        }
                    });

                    if (hasTooManyKnownPeers() && hasEnoughConnectedPublicPeers(Peers.maxNumberOfConnectedPublicPeers)) {
                        int initialSize = peers.size();
                        for (PeerImpl peer : peers.values()) {
                            if (now - peer.getLastUpdated() > 24 * 3600) {
                                peer.remove();
                            }
                            if (hasTooFewKnownPeers()) {
                                break;
                            }
                        }
                        if (hasTooManyKnownPeers()) {
                            PriorityQueue<PeerImpl> sortedPeers = new PriorityQueue<>(peers.values());
                            int skipped = 0;
                            while (skipped < Peers.minNumberOfKnownPeers) {
                                if (sortedPeers.poll() == null) {
                                    break;
                                }
                                skipped += 1;
                            }
                            while (!sortedPeers.isEmpty()) {
                                sortedPeers.poll().remove();
                            }
                        }
                        Logger.logDebugMessage("Reduced peer pool size from " + initialSize + " to " + peers.size());
                    }

                    for (String wellKnownPeer : wellKnownPeers) {
                        PeerImpl peer = findOrCreatePeer(wellKnownPeer, true);
                        if (peer != null && now - peer.getLastUpdated() > 3600 && now - peer.getLastConnectAttempt() > 600) {
                            peersService.submit(() -> {
                                addPeer(peer);
                                connectPeer(peer);
                            });
                        }
                    }

                    peers.values().forEach(peer -> {
                        if (peer.getLastInboundRequest() != 0 && now - peer.getLastInboundRequest() > Peers.webSocketIdleTimeout / 1000) {
                            peer.setLastInboundRequest(0);
                            notifyListeners(peer, Event.REMOVE_INBOUND);
                        }
                    });

                } catch (Exception e) {
                    Logger.logDebugMessage("Error connecting to peer", e);
                }
            } catch (Throwable t) {
                Logger.logErrorMessage("CRITICAL ERROR. PLEASE REPORT TO THE DEVELOPERS.\n" + t.toString());
                t.printStackTrace();
                System.exit(1);
            }

        }

    };

    private static final Runnable getMorePeersThread = new Runnable() {

        private final JSONStreamAware getPeersRequest;
        {
            JSONObject request = new JSONObject();
            request.put("requestType", "getPeers");
            getPeersRequest = JSON.prepareRequest(request);
        }

        private volatile boolean updatedPeer;

        @Override
        public void run() {

            try {
                try {
                    if (hasTooManyKnownPeers()) {
                        return;
                    }
                    Peer peer = getAnyPeer(Peer.State.CONNECTED, true);
                    if (peer == null) {
                        return;
                    }
                    JSONObject response = peer.send(getPeersRequest, 10 * 1024 * 1024);
                    if (response == null) {
                        return;
                    }
                    JSONArray peers = (JSONArray)response.get("peers");
                    Set<String> addedAddresses = new HashSet<>();
                    if (peers != null) {
                        int now = Lrd.getEpochTime();
                        for (Object announcedAddress : peers) {
                            PeerImpl newPeer = findOrCreatePeer((String) announcedAddress, true);
                            if (newPeer != null) {
                                if (now - newPeer.getLastUpdated() > 24 * 3600) {
                                    newPeer.setLastUpdated(now);
                                    updatedPeer = true;
                                }
                                Peers.addPeer(newPeer);
                                addedAddresses.add((String) announcedAddress);
                                if (hasTooManyKnownPeers()) {
                                    break;
                                }
                            }
                        }
                        if (savePeers && updatedPeer) {
                            updateSavedPeers();
                            updatedPeer = false;
                        }
                    }

                    JSONArray myPeers = new JSONArray();
                    Peers.getAllPeers().forEach(myPeer -> {
                        if (!myPeer.isBlacklisted() && myPeer.getAnnouncedAddress() != null
                                && myPeer.getState() == Peer.State.CONNECTED && myPeer.shareAddress()
                                && !addedAddresses.contains(myPeer.getAnnouncedAddress())
                                && !myPeer.getAnnouncedAddress().equals(peer.getAnnouncedAddress())) {
                            myPeers.add(myPeer.getAnnouncedAddress());
                        }
                    });
                    if (myPeers.size() > 0) {
                        JSONObject request = new JSONObject();
                        request.put("requestType", "addPeers");
                        request.put("peers", myPeers);
                        peer.send(JSON.prepareRequest(request), 0);
                    }

                } catch (Exception e) {
                    Logger.logDebugMessage("Error requesting peers from a peer", e);
                }
            } catch (Throwable t) {
                Logger.logErrorMessage("CRITICAL ERROR. PLEASE REPORT TO THE DEVELOPERS.\n" + t.toString());
                t.printStackTrace();
                System.exit(1);
            }

        }

        private void updateSavedPeers() {
            int now = Lrd.getEpochTime();
            //
            // Load the current database entries and map the announced address to database entry
            //
            List<PeerDb.Entry> oldPeers = PeerDb.loadPeers();
            Map<String, PeerDb.Entry> oldMap = new HashMap<>();
            oldPeers.forEach(entry -> oldMap.put(entry.getAddress(), entry));
            //
            // Create the current peer map (note that there can be duplicate peer entries with
            // the same announced address)
            //
            Map<String, PeerDb.Entry> currentPeers = new HashMap<>();
            Peers.peers.values().forEach(peer -> {
                if (peer.getAnnouncedAddress() != null && !peer.isBlacklisted() && now - peer.getLastUpdated() < 7*24*3600)
                    currentPeers.put(peer.getAnnouncedAddress(), new PeerDb.Entry(peer.getAnnouncedAddress(), peer.getLastUpdated()));
            });
            //
            // Build toDelete, toUpdate and toAdd lists
            //
            List<PeerDb.Entry> toDelete = new ArrayList<>(oldPeers.size());
            oldPeers.forEach(entry -> {
                if (currentPeers.get(entry.getAddress()) == null)
                    toDelete.add(entry);
            });
            List<PeerDb.Entry> toUpdate = new ArrayList<>(currentPeers.size());
            List<PeerDb.Entry> toAdd = new ArrayList<>(currentPeers.size());
            currentPeers.values().forEach(entry -> {
                PeerDb.Entry oldEntry = oldMap.get(entry.getAddress());
                if (oldEntry == null)
                    toAdd.add(entry);
                else if (entry.getLastUpdated() - oldEntry.getLastUpdated() > 24*3600)
                    toUpdate.add(entry);
            });
            //
            // Nothing to do if all of the lists are empty
            //
            if (toDelete.isEmpty() && toUpdate.isEmpty() && toAdd.isEmpty())
                return;
            //
            // Update the peer database
            //
            try {
                Db.db.beginTransaction();
                PeerDb.deletePeers(toDelete);
                PeerDb.updatePeers(toUpdate);
                PeerDb.addPeers(toAdd);
                Db.db.commitTransaction();
            } catch (Exception e) {
                Db.db.rollbackTransaction();
                throw e;
            } finally {
                Db.db.endTransaction();
            }
        }

    };

    static {
        Account.addListener(account -> peers.values().forEach(peer -> {
            if (peer.getHallmark() != null && peer.getHallmark().getAccountId() == account.getId()) {
                Peers.listeners.notify(peer, Event.WEIGHT);
            }
        }), Account.Event.BALANCE);
    }

    static {
        if (! Constants.isOffline) {
            ThreadPool.scheduleThread("PeerConnecting", Peers.peerConnectingThread, 20);
            ThreadPool.scheduleThread("PeerUnBlacklisting", Peers.peerUnBlacklistingThread, 60);
            if (Peers.getMorePeers) {
                ThreadPool.scheduleThread("GetMorePeers", Peers.getMorePeersThread, 20);
            }
        }
    }

    public static void init() {
        Init.init();
    }

    public static void shutdown() {
        if (Init.peerServer != null) {
            try {
                Init.peerServer.stop();
                if (enablePeerUPnP) {
                    Connector[] peerConnectors = Init.peerServer.getConnectors();
                    for (Connector peerConnector : peerConnectors) {
                        if (peerConnector instanceof ServerConnector)
                            UPnP.deletePort(((ServerConnector)peerConnector).getPort());
                    }
                }
            } catch (Exception e) {
                Logger.logShutdownMessage("Failed to stop peer server", e);
            }
        }
        ThreadPool.shutdownExecutor("sendingService", sendingService, 2);
        ThreadPool.shutdownExecutor("peersService", peersService, 5);
    }

    public static boolean addListener(Listener<Peer> listener, Event eventType) {
        return Peers.listeners.addListener(listener, eventType);
    }

    public static boolean removeListener(Listener<Peer> listener, Event eventType) {
        return Peers.listeners.removeListener(listener, eventType);
    }

    static void notifyListeners(Peer peer, Event eventType) {
        Peers.listeners.notify(peer, eventType);
    }

    public static int getDefaultPeerPort() {
        return Constants.isTestnet ? TESTNET_PEER_PORT : DEFAULT_PEER_PORT;
    }

    public static Collection<? extends Peer> getAllPeers() {
        return allPeers;
    }

    public static List<Peer> getActivePeers() {
        return getPeers(peer -> peer.getState() != Peer.State.NON_CONNECTED);
    }

    public static List<Peer> getPeers(final Peer.State state) {
        return getPeers(peer -> peer.getState() == state);
    }

    public static List<Peer> getPeers(Filter<Peer> filter) {
        return getPeers(filter, Integer.MAX_VALUE);
    }

    public static List<Peer> getPeers(Filter<Peer> filter, int limit) {
        List<Peer> result = new ArrayList<>();
        for (Peer peer : peers.values()) {
            if (filter.ok(peer)) {
                result.add(peer);
                if (result.size() >= limit) {
                    break;
                }
            }
        }
        return result;
    }

    public static Peer getPeer(String host) {
        return peers.get(host);
    }

    public static List<Peer> getInboundPeers() {
        return getPeers(Peer::isInbound);
    }

    public static boolean hasTooManyInboundPeers() {
        return getPeers(Peer::isInbound, maxNumberOfInboundConnections).size() >= maxNumberOfInboundConnections;
    }

    public static boolean hasTooManyOutboundConnections() {
        return getPeers(peer -> !peer.isBlacklisted() && peer.getState() == Peer.State.CONNECTED && peer.getAnnouncedAddress() != null,
                maxNumberOfOutboundConnections).size() >= maxNumberOfOutboundConnections;
    }

    public static PeerImpl findOrCreatePeer(String announcedAddress, boolean create) {
        if (announcedAddress == null) {
            return null;
        }
        announcedAddress = announcedAddress.trim().toLowerCase();
        PeerImpl peer;
        if ((peer = peers.get(announcedAddress)) != null) {
            return peer;
        }
        String host = selfAnnouncedAddresses.get(announcedAddress);
        if (host != null && (peer = peers.get(host)) != null) {
            return peer;
        }
        try {
            URI uri = new URI("http://" + announcedAddress);
            host = uri.getHost();
            if (host == null) {
                return null;
            }
            if ((peer = peers.get(host)) != null) {
                return peer;
            }
            String host2 = selfAnnouncedAddresses.get(host);
            if (host2 != null && (peer = peers.get(host2)) != null) {
                return peer;
            }
            InetAddress inetAddress = InetAddress.getByName(host);
            return findOrCreatePeer(inetAddress, addressWithPort(announcedAddress), create);
        } catch (URISyntaxException | UnknownHostException e) {
            //Logger.logDebugMessage("Invalid peer address: " + announcedAddress + ", " + e.toString());
            return null;
        }
    }

    static PeerImpl findOrCreatePeer(String host) {
        try {
            InetAddress inetAddress = InetAddress.getByName(host);
            return findOrCreatePeer(inetAddress, null, true);
        } catch (UnknownHostException e) {
            return null;
        }
    }

    static PeerImpl findOrCreatePeer(final InetAddress inetAddress, final String announcedAddress, final boolean create) {

        if (inetAddress.isAnyLocalAddress() || inetAddress.isLoopbackAddress() || inetAddress.isLinkLocalAddress()) {
            return null;
        }

        String host = inetAddress.getHostAddress();
        if (Peers.cjdnsOnly && !host.substring(0,2).equals("fc")) {
            return null;
        }
        //re-add the [] to ipv6 addresses lost in getHostAddress() above
        if (host.split(":").length > 2) {
            host = "[" + host + "]";
        }

        PeerImpl peer;
        if ((peer = peers.get(host)) != null) {
            return peer;
        }
        if (!create) {
            return null;
        }

        if (Peers.myAddress != null && Peers.myAddress.equalsIgnoreCase(announcedAddress)) {
            return null;
        }
        if (announcedAddress != null && announcedAddress.length() > MAX_ANNOUNCED_ADDRESS_LENGTH) {
            return null;
        }
        peer = new PeerImpl(host, announcedAddress);
        if (Constants.isTestnet && peer.getPort() != TESTNET_PEER_PORT) {
            Logger.logDebugMessage("Peer " + host + " on testnet is not using port " + TESTNET_PEER_PORT + ", ignoring");
            return null;
        }
        if (!Constants.isTestnet && peer.getPort() == TESTNET_PEER_PORT) {
            Logger.logDebugMessage("Peer " + host + " is using testnet port " + peer.getPort() + ", ignoring");
            return null;
        }
        return peer;
    }

    static void setAnnouncedAddress(PeerImpl peer, String newAnnouncedAddress) {
        Peer oldPeer = peers.get(peer.getHost());
        if (oldPeer != null) {
            String oldAnnouncedAddress = oldPeer.getAnnouncedAddress();
            if (oldAnnouncedAddress != null && !oldAnnouncedAddress.equals(newAnnouncedAddress)) {
                Logger.logDebugMessage("Removing old announced address " + oldAnnouncedAddress + " for peer " + oldPeer.getHost());
                selfAnnouncedAddresses.remove(oldAnnouncedAddress);
            }
        }
        if (newAnnouncedAddress != null) {
            String oldHost = selfAnnouncedAddresses.put(newAnnouncedAddress, peer.getHost());
            if (oldHost != null && !peer.getHost().equals(oldHost)) {
                Logger.logDebugMessage("Announced address " + newAnnouncedAddress + " now maps to peer " + peer.getHost()
                        + ", removing old peer " + oldHost);
                oldPeer = peers.remove(oldHost);
                if (oldPeer != null) {
                    Peers.notifyListeners(oldPeer, Event.REMOVE);
                }
            }
        }
        peer.setAnnouncedAddress(newAnnouncedAddress);
    }

    public static boolean addPeer(Peer peer, String newAnnouncedAddress) {
        setAnnouncedAddress((PeerImpl)peer, newAnnouncedAddress.toLowerCase());
        return addPeer(peer);
    }

    public static boolean addPeer(Peer peer) {
        if (peers.put(peer.getHost(), (PeerImpl) peer) == null) {
            listeners.notify(peer, Event.NEW_PEER);
            return true;
        }
        return false;
    }

    public static PeerImpl removePeer(Peer peer) {
        if (peer.getAnnouncedAddress() != null) {
            selfAnnouncedAddresses.remove(peer.getAnnouncedAddress());
        }
        return peers.remove(peer.getHost());
    }

    public static void connectPeer(Peer peer) {
        peer.unBlacklist();
        ((PeerImpl)peer).connect();
    }

    public static void sendToSomePeers(Block block) {
        JSONObject request = block.getJSONObject();
        request.put("requestType", "processBlock");
        sendToSomePeers(request);
    }

    private static final int sendTransactionsBatchSize = 10;

    public static void sendToSomePeers(List<? extends Transaction> transactions) {
        int nextBatchStart = 0;
        while (nextBatchStart < transactions.size()) {
            JSONObject request = new JSONObject();
            JSONArray transactionsData = new JSONArray();
            for (int i = nextBatchStart; i < nextBatchStart + sendTransactionsBatchSize && i < transactions.size(); i++) {
                transactionsData.add(transactions.get(i).getJSONObject());
            }
            request.put("requestType", "processTransactions");
            request.put("transactions", transactionsData);
            sendToSomePeers(request);
            nextBatchStart += sendTransactionsBatchSize;
        }
    }

    private static void sendToSomePeers(final JSONObject request) {
        sendingService.submit(() -> {
            final JSONStreamAware jsonRequest = JSON.prepareRequest(request);

            int successful = 0;
            List<Future<JSONObject>> expectedResponses = new ArrayList<>();
            for (final Peer peer : peers.values()) {

                if (Peers.enableHallmarkProtection && peer.getWeight() < Peers.pushThreshold) {
                    continue;
                }

                if (!peer.isBlacklisted() && peer.getState() == Peer.State.CONNECTED && peer.getAnnouncedAddress() != null) {
                    Future<JSONObject> futureResponse = peersService.submit(() -> peer.send(jsonRequest));
                    expectedResponses.add(futureResponse);
                }
                if (expectedResponses.size() >= Peers.sendToPeersLimit - successful) {
                    for (Future<JSONObject> future : expectedResponses) {
                        try {
                            JSONObject response = future.get();
                            if (response != null && response.get("error") == null) {
                                successful += 1;
                            }
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                        } catch (ExecutionException e) {
                            Logger.logDebugMessage("Error in sendToSomePeers", e);
                        }

                    }
                    expectedResponses.clear();
                }
                if (successful >= Peers.sendToPeersLimit) {
                    return;
                }
            }
        });
    }

    public static Peer getAnyPeer(final Peer.State state, final boolean applyPullThreshold) {
        return getWeightedPeer(getPublicPeers(state, applyPullThreshold));
    }

    public static List<Peer> getPublicPeers(final Peer.State state, final boolean applyPullThreshold) {
        return getPeers(peer -> !peer.isBlacklisted() && peer.getState() == state && peer.getAnnouncedAddress() != null
                && (!applyPullThreshold || !Peers.enableHallmarkProtection || peer.getWeight() >= Peers.pullThreshold));
    }

    public static Peer getWeightedPeer(List<Peer> selectedPeers) {
        if (selectedPeers.isEmpty()) {
            return null;
        }
        if (! Peers.enableHallmarkProtection || ThreadLocalRandom.current().nextInt(3) == 0) {
            return selectedPeers.get(ThreadLocalRandom.current().nextInt(selectedPeers.size()));
        }
        long totalWeight = 0;
        for (Peer peer : selectedPeers) {
            long weight = peer.getWeight();
            if (weight == 0) {
                weight = 1;
            }
            totalWeight += weight;
        }
        long hit = ThreadLocalRandom.current().nextLong(totalWeight);
        for (Peer peer : selectedPeers) {
            long weight = peer.getWeight();
            if (weight == 0) {
                weight = 1;
            }
            if ((hit -= weight) < 0) {
                return peer;
            }
        }
        return null;
    }

    static String addressWithPort(String address) {
        if (address == null) {
            return null;
        }
        try {
            URI uri = new URI("http://" + address);
            String host = uri.getHost();
            int port = uri.getPort();
            return port > 0 && port != Peers.getDefaultPeerPort() ? host + ":" + port : host;
        } catch (URISyntaxException e) {
            return null;
        }
    }

    public static boolean hasTooFewKnownPeers() {
        return peers.size() < Peers.minNumberOfKnownPeers;
    }

    public static boolean hasTooManyKnownPeers() {
        return peers.size() > Peers.maxNumberOfKnownPeers;
    }

    private static boolean hasEnoughConnectedPublicPeers(int limit) {
        return getPeers(peer -> !peer.isBlacklisted() && peer.getState() == Peer.State.CONNECTED && peer.getAnnouncedAddress() != null
                && (! Peers.enableHallmarkProtection || peer.getWeight() > 0), limit).size() >= limit;
    }

    /**
     * Set the communication logging mask
     *
     * @param   events              Communication event list or null to reset communications logging
     * @return                      TRUE if the communication logging mask was updated
     */
    public static boolean setCommunicationLoggingMask(String[] events) {
        boolean updated = true;
        int mask = 0;
        if (events != null) {
            for (String event : events) {
                switch (event) {
                    case "EXCEPTION":
                        mask |= LOGGING_MASK_EXCEPTIONS;
                        break;
                    case "HTTP-ERROR":
                        mask |= LOGGING_MASK_NON200_RESPONSES;
                        break;
                    case "HTTP-OK":
                        mask |= LOGGING_MASK_200_RESPONSES;
                        break;
                    default:
                        updated = false;
                }
                if (!updated)
                    break;
            }
        }
        if (updated)
            communicationLoggingMask = mask;
        return updated;
    }

    private Peers() {} // never

}