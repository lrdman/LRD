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

package lrd;

import lrd.db.DbClause;
import lrd.db.DbIterator;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public abstract class CurrencyExchangeOffer {

    static {

        Lrd.getBlockchainProcessor().addListener(block -> {
            if (block.getHeight() <= Constants.MONETARY_SYSTEM_BLOCK) {
                return;
            }
            List<CurrencyBuyOffer> expired = new ArrayList<>();
            try (DbIterator<CurrencyBuyOffer> offers = CurrencyBuyOffer.getOffers(new DbClause.IntClause("expiration_height", block.getHeight()), 0, -1)) {
                for (CurrencyBuyOffer offer : offers) {
                    expired.add(offer);
                }
            }
            expired.forEach(CurrencyExchangeOffer::removeOffer);
        }, BlockchainProcessor.Event.AFTER_BLOCK_APPLY);

    }

    static void publishOffer(Transaction transaction, Attachment.MonetarySystemPublishExchangeOffer attachment) {
        CurrencyBuyOffer previousOffer = CurrencyBuyOffer.getOffer(attachment.getCurrencyId(), transaction.getSenderId());
        if (previousOffer != null) {
            removeOffer(previousOffer);
        }
        CurrencyBuyOffer.addOffer(transaction, attachment);
        CurrencySellOffer.addOffer(transaction, attachment);
    }

    private static final class ValidOffersDbClause extends DbClause {

        private final long currencyId;
        private final long rateLQT;

        private ValidOffersDbClause(long currencyId, long rateLQT, boolean rateDescending) {
            super(rateDescending ? " currency_id = ? AND unit_limit <> 0 AND supply <> 0 AND rate >= ? "
                            : " currency_id = ? AND unit_limit <> 0 AND supply <> 0 AND rate <= ? ");
            this.currencyId = currencyId;
            this.rateLQT = rateLQT;
        }

        @Override
        protected int set(PreparedStatement pstmt, int index) throws SQLException {
            pstmt.setLong(index++, currencyId);
            pstmt.setLong(index++, rateLQT);
            return index;
        }

    }

    static final DbClause availableOnlyDbClause = new DbClause.FixedClause(" unit_limit <> 0 AND supply <> 0 ");

    static void exchangeCurrencyForLRD(Transaction transaction, Account account, final long currencyId, final long rateLQT, long units) {
        long extraAmountLQT = 0;
        long remainingUnits = units;

        List<CurrencyBuyOffer> currencyBuyOffers = new ArrayList<>();
        try (DbIterator<CurrencyBuyOffer> offers = CurrencyBuyOffer.getOffers(new ValidOffersDbClause(currencyId, rateLQT, true), 0, -1,
                " ORDER BY rate DESC, creation_height ASC, transaction_height ASC, transaction_index ASC ")) {
            for (CurrencyBuyOffer offer : offers) {
                currencyBuyOffers.add(offer);
            }
        }

        for (CurrencyBuyOffer offer : currencyBuyOffers) {
            if (remainingUnits == 0) {
                break;
            }
            long curUnits = Math.min(Math.min(remainingUnits, offer.getSupply()), offer.getLimit());
            long curAmountLQT = Math.multiplyExact(curUnits, offer.getRateLQT());

            extraAmountLQT = Math.addExact(extraAmountLQT, curAmountLQT);
            remainingUnits = Math.subtractExact(remainingUnits, curUnits);

            offer.decreaseLimitAndSupply(curUnits);
            long excess = offer.getCounterOffer().increaseSupply(curUnits);

            Account counterAccount = Account.getAccount(offer.getAccountId());
            counterAccount.addToBalanceLQT(-curAmountLQT);
            counterAccount.addToCurrencyUnits(currencyId, curUnits);
            counterAccount.addToUnconfirmedCurrencyUnits(currencyId, excess);
            Exchange.addExchange(transaction, currencyId, offer, account.getId(), offer.getAccountId(), curUnits);
        }

        account.addToBalanceAndUnconfirmedBalanceLQT(extraAmountLQT);
        account.addToCurrencyUnits(currencyId, -(units - remainingUnits));
        account.addToUnconfirmedCurrencyUnits(currencyId, remainingUnits);
    }

    static void exchangeLRDForCurrency(Transaction transaction, Account account, final long currencyId, final long rateLQT, long units) {
        long extraUnits = 0;
        long remainingAmountLQT = Math.multiplyExact(units, rateLQT);

        List<CurrencySellOffer> currencySellOffers = new ArrayList<>();
        try (DbIterator<CurrencySellOffer> offers = CurrencySellOffer.getOffers(new ValidOffersDbClause(currencyId, rateLQT, false), 0, -1,
                " ORDER BY rate ASC, creation_height ASC, transaction_height ASC, transaction_index ASC ")) {
            for (CurrencySellOffer offer : offers) {
                currencySellOffers.add(offer);
            }
        }

        for (CurrencySellOffer offer : currencySellOffers) {
            if (remainingAmountLQT == 0) {
                break;
            }
            long curUnits = Math.min(Math.min(remainingAmountLQT / offer.getRateLQT(), offer.getSupply()), offer.getLimit());
            if (curUnits == 0) {
                continue;
            }
            long curAmountLQT = Math.multiplyExact(curUnits, offer.getRateLQT());

            extraUnits = Math.addExact(extraUnits, curUnits);
            remainingAmountLQT = Math.subtractExact(remainingAmountLQT, curAmountLQT);

            offer.decreaseLimitAndSupply(curUnits);
            long excess = offer.getCounterOffer().increaseSupply(curUnits);

            Account counterAccount = Account.getAccount(offer.getAccountId());
            counterAccount.addToBalanceLQT(curAmountLQT);
            counterAccount.addToUnconfirmedBalanceLQT(Math.addExact(Math.multiplyExact(curUnits - excess, offer.getRateLQT() - offer.getCounterOffer().getRateLQT()), Math.multiplyExact(excess, offer.getRateLQT())));
            counterAccount.addToCurrencyUnits(currencyId, -curUnits);
            Exchange.addExchange(transaction, currencyId, offer, offer.getAccountId(), account.getId(), curUnits);
        }

        account.addToCurrencyAndUnconfirmedCurrencyUnits(currencyId, extraUnits);
        account.addToBalanceLQT(-(Math.multiplyExact(units, rateLQT) - remainingAmountLQT));
        account.addToUnconfirmedBalanceLQT(remainingAmountLQT);
    }

    static void removeOffer(CurrencyBuyOffer buyOffer) {
        CurrencySellOffer sellOffer = buyOffer.getCounterOffer();

        CurrencyBuyOffer.remove(buyOffer);
        CurrencySellOffer.remove(sellOffer);

        Account account = Account.getAccount(buyOffer.getAccountId());
        account.addToUnconfirmedBalanceLQT(Math.multiplyExact(buyOffer.getSupply(), buyOffer.getRateLQT()));
        account.addToUnconfirmedCurrencyUnits(buyOffer.getCurrencyId(), sellOffer.getSupply());
    }


    final long id;
    private final long currencyId;
    private final long accountId;
    private final long rateLQT;
    private long limit; // limit on the total sum of units for this offer across transactions
    private long supply; // total units supply for the offer
    private final int expirationHeight;
    private final int creationHeight;
    private final short transactionIndex;
    private final int transactionHeight;

    CurrencyExchangeOffer(long id, long currencyId, long accountId, long rateLQT, long limit, long supply,
                          int expirationHeight, int transactionHeight, short transactionIndex) {
        this.id = id;
        this.currencyId = currencyId;
        this.accountId = accountId;
        this.rateLQT = rateLQT;
        this.limit = limit;
        this.supply = supply;
        this.expirationHeight = expirationHeight;
        this.creationHeight = Lrd.getBlockchain().getHeight();
        this.transactionIndex = transactionIndex;
        this.transactionHeight = transactionHeight;
    }

    CurrencyExchangeOffer(ResultSet rs) throws SQLException {
        this.id = rs.getLong("id");
        this.currencyId = rs.getLong("currency_id");
        this.accountId = rs.getLong("account_id");
        this.rateLQT = rs.getLong("rate");
        this.limit = rs.getLong("unit_limit");
        this.supply = rs.getLong("supply");
        this.expirationHeight = rs.getInt("expiration_height");
        this.creationHeight = rs.getInt("creation_height");
        this.transactionIndex = rs.getShort("transaction_index");
        this.transactionHeight = rs.getInt("transaction_height");
    }

    void save(Connection con, String table) throws SQLException {
        try (PreparedStatement pstmt = con.prepareStatement("MERGE INTO " + table + " (id, currency_id, account_id, "
                + "rate, unit_limit, supply, expiration_height, creation_height, transaction_index, transaction_height, height, latest) "
                + "KEY (id, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)")) {
            int i = 0;
            pstmt.setLong(++i, this.id);
            pstmt.setLong(++i, this.currencyId);
            pstmt.setLong(++i, this.accountId);
            pstmt.setLong(++i, this.rateLQT);
            pstmt.setLong(++i, this.limit);
            pstmt.setLong(++i, this.supply);
            pstmt.setInt(++i, this.expirationHeight);
            pstmt.setInt(++i, this.creationHeight);
            pstmt.setShort(++i, this.transactionIndex);
            pstmt.setInt(++i, this.transactionHeight);
            pstmt.setInt(++i, Lrd.getBlockchain().getHeight());
            pstmt.executeUpdate();
        }
    }

    public long getId() {
        return id;
    }

    public long getCurrencyId() {
        return currencyId;
    }

    public long getAccountId() {
        return accountId;
    }

    public long getRateLQT() {
        return rateLQT;
    }

    public long getLimit() {
        return limit;
    }

    public long getSupply() {
        return supply;
    }

    public int getExpirationHeight() {
        return expirationHeight;
    }

    public int getHeight() {
        return creationHeight;
    }

    public abstract CurrencyExchangeOffer getCounterOffer();

    long increaseSupply(long delta) {
        long excess = Math.max(Math.addExact(supply, Math.subtractExact(delta, limit)), 0);
        supply += delta - excess;
        return excess;
    }

    void decreaseLimitAndSupply(long delta) {
        limit -= delta;
        supply -= delta;
    }
}
