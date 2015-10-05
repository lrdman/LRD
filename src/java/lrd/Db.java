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

import lrd.db.BasicDb;
import lrd.db.TransactionalDb;

public final class Db {

    public static final String PREFIX = Constants.isTestnet ? "lrd.testDb" : "lrd.db";
    public static final TransactionalDb db = new TransactionalDb(new BasicDb.DbProperties()
            .maxCacheSize(Lrd.getIntProperty("lrd.dbCacheKB"))
            .dbUrl(Lrd.getStringProperty(PREFIX + "Url"))
            .dbType(Lrd.getStringProperty(PREFIX + "Type"))
            .dbDir(Lrd.getStringProperty(PREFIX + "Dir"))
            .dbParams(Lrd.getStringProperty(PREFIX + "Params"))
            .dbUsername(Lrd.getStringProperty(PREFIX + "Username"))
            .dbPassword(Lrd.getStringProperty(PREFIX + "Password", null, true))
            .maxConnections(Lrd.getIntProperty("lrd.maxDbConnections"))
            .loginTimeout(Lrd.getIntProperty("lrd.dbLoginTimeout"))
            .defaultLockTimeout(Lrd.getIntProperty("lrd.dbDefaultLockTimeout") * 1000)
    );

    static void init() {
        db.init(new LrdDbVersion());
    }

    static void shutdown() {
        db.shutdown();
    }

    private Db() {} // never

}
