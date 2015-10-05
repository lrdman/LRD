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
import lrd.db.DbKey;
import lrd.db.EntityDbTable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class PhasingVote {

    private static final DbKey.LinkKeyFactory<PhasingVote> phasingVoteDbKeyFactory = new DbKey.LinkKeyFactory<PhasingVote>("transaction_id", "voter_id") {
        @Override
        public DbKey newKey(PhasingVote vote) {
            return vote.dbKey;
        }
    };

    private static final EntityDbTable<PhasingVote> phasingVoteTable = new EntityDbTable<PhasingVote>("phasing_vote", phasingVoteDbKeyFactory) {

        @Override
        protected PhasingVote load(Connection con, ResultSet rs) throws SQLException {
            return new PhasingVote(rs);
        }

        @Override
        protected void save(Connection con, PhasingVote vote) throws SQLException {
            vote.save(con);
        }

    };

    public static DbIterator<PhasingVote> getVotes(long phasedTransactionId, int from, int to) {
        return phasingVoteTable.getManyBy(new DbClause.LongClause("transaction_id", phasedTransactionId), from, to);
    }

    public static PhasingVote getVote(long phasedTransactionId, long voterId) {
        return phasingVoteTable.get(phasingVoteDbKeyFactory.newKey(phasedTransactionId, voterId));
    }

    public static long getVoteCount(long phasedTransactionId) {
        return phasingVoteTable.getCount(new DbClause.LongClause("transaction_id", phasedTransactionId));
    }

    static void addVote(Transaction transaction, Account voter, long phasedTransactionId) {
        PhasingVote phasingVote = phasingVoteTable.get(phasingVoteDbKeyFactory.newKey(phasedTransactionId, voter.getId()));
        if (phasingVote == null) {
            phasingVote = new PhasingVote(transaction, voter, phasedTransactionId);
            phasingVoteTable.insert(phasingVote);
        }
    }

    static void init() {
    }

    private final long phasedTransactionId;
    private final long voterId;
    private final DbKey dbKey;
    private long voteId;

    private PhasingVote(Transaction transaction, Account voter, long phasedTransactionId) {
        this.phasedTransactionId = phasedTransactionId;
        this.voterId = voter.getId();
        this.dbKey = phasingVoteDbKeyFactory.newKey(this.phasedTransactionId, this.voterId);
        this.voteId = transaction.getId();
    }

    private PhasingVote(ResultSet rs) throws SQLException {
        this.phasedTransactionId = rs.getLong("transaction_id");
        this.voterId = rs.getLong("voter_id");
        this.dbKey = phasingVoteDbKeyFactory.newKey(this.phasedTransactionId, this.voterId);
        this.voteId = rs.getLong("vote_id");
    }

    public long getPhasedTransactionId() {
        return phasedTransactionId;
    }

    public long getVoterId() {
        return voterId;
    }

    public long getVoteId() {
        return voteId;
    }

    private void save(Connection con) throws SQLException {
        try (PreparedStatement pstmt = con.prepareStatement("INSERT INTO phasing_vote (vote_id, transaction_id, "
                + "voter_id, height) VALUES (?, ?, ?, ?)")) {
            int i = 0;
            pstmt.setLong(++i, this.voteId);
            pstmt.setLong(++i, this.phasedTransactionId);
            pstmt.setLong(++i, this.voterId);
            pstmt.setInt(++i, Lrd.getBlockchain().getHeight());
            pstmt.executeUpdate();
        }
    }

}
