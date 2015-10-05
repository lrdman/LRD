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

import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.List;

class UnconfirmedTransaction implements Transaction {

    private final TransactionImpl transaction;
    private final long arrivalTimestamp;
    private final long feePerByte;

    UnconfirmedTransaction(TransactionImpl transaction, long arrivalTimestamp) {
        this.transaction = transaction;
        this.arrivalTimestamp = arrivalTimestamp;
        this.feePerByte = transaction.getFeeLQT() / transaction.getFullSize();
    }

    UnconfirmedTransaction(ResultSet rs) throws SQLException {
        try {
            byte[] transactionBytes = rs.getBytes("transaction_bytes");
            JSONObject prunableAttachments = null;
            String prunableJSON = rs.getString("prunable_json");
            if (prunableJSON != null) {
                prunableAttachments = (JSONObject) JSONValue.parse(prunableJSON);
            }
            TransactionImpl.BuilderImpl builder = TransactionImpl.newTransactionBuilder(transactionBytes, prunableAttachments);
            this.transaction = builder.build();
            this.transaction.setHeight(rs.getInt("transaction_height"));
            this.arrivalTimestamp = rs.getLong("arrival_timestamp");
            this.feePerByte = rs.getLong("fee_per_byte");
        } catch (LrdException.ValidationException e) {
            throw new RuntimeException(e.toString(), e);
        }
    }

    void save(Connection con) throws SQLException {
        try (PreparedStatement pstmt = con.prepareStatement("INSERT INTO unconfirmed_transaction (id, transaction_height, "
                + "fee_per_byte, expiration, transaction_bytes, prunable_json, arrival_timestamp, height) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            int i = 0;
            pstmt.setLong(++i, transaction.getId());
            pstmt.setInt(++i, transaction.getHeight());
            pstmt.setLong(++i, feePerByte);
            pstmt.setInt(++i, transaction.getExpiration());
            pstmt.setBytes(++i, transaction.bytes());
            JSONObject prunableJSON = transaction.getPrunableAttachmentJSON();
            if (prunableJSON != null) {
                pstmt.setString(++i, prunableJSON.toJSONString());
            } else {
                pstmt.setNull(++i, Types.VARCHAR);
            }
            pstmt.setLong(++i, arrivalTimestamp);
            pstmt.setInt(++i, Lrd.getBlockchain().getHeight());
            pstmt.executeUpdate();
        }
    }

    TransactionImpl getTransaction() {
        return transaction;
    }

    long getArrivalTimestamp() {
        return arrivalTimestamp;
    }

    long getFeePerByte() {
        return feePerByte;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof UnconfirmedTransaction && transaction.equals(((UnconfirmedTransaction)o).getTransaction());
    }

    @Override
    public int hashCode() {
        return transaction.hashCode();
    }

    @Override
    public long getId() {
        return transaction.getId();
    }

    @Override
    public String getStringId() {
        return transaction.getStringId();
    }

    @Override
    public long getSenderId() {
        return transaction.getSenderId();
    }

    @Override
    public byte[] getSenderPublicKey() {
        return transaction.getSenderPublicKey();
    }

    @Override
    public long getRecipientId() {
        return transaction.getRecipientId();
    }

    @Override
    public int getHeight() {
        return transaction.getHeight();
    }

    @Override
    public long getBlockId() {
        return transaction.getBlockId();
    }

    @Override
    public Block getBlock() {
        return transaction.getBlock();
    }

    @Override
    public int getTimestamp() {
        return transaction.getTimestamp();
    }

    @Override
    public int getBlockTimestamp() {
        return transaction.getBlockTimestamp();
    }

    @Override
    public short getDeadline() {
        return transaction.getDeadline();
    }

    @Override
    public int getExpiration() {
        return transaction.getExpiration();
    }

    @Override
    public long getAmountLQT() {
        return transaction.getAmountLQT();
    }

    @Override
    public long getFeeLQT() {
        return transaction.getFeeLQT();
    }

    @Override
    public String getReferencedTransactionFullHash() {
        return transaction.getReferencedTransactionFullHash();
    }

    @Override
    public byte[] getSignature() {
        return transaction.getSignature();
    }

    @Override
    public String getFullHash() {
        return transaction.getFullHash();
    }

    @Override
    public TransactionType getType() {
        return transaction.getType();
    }

    @Override
    public Attachment getAttachment() {
        return transaction.getAttachment();
    }

    @Override
    public boolean verifySignature() {
        return transaction.verifySignature();
    }

    @Override
    public void validate() throws LrdException.ValidationException {
        transaction.validate();
    }

    @Override
    public byte[] getBytes() {
        return transaction.getBytes();
    }

    @Override
    public byte[] getUnsignedBytes() {
        return transaction.getUnsignedBytes();
    }

    @Override
    public JSONObject getJSONObject() {
        return transaction.getJSONObject();
    }

    @Override
    public JSONObject getPrunableAttachmentJSON() {
        return transaction.getPrunableAttachmentJSON();
    }

    @Override
    public byte getVersion() {
        return transaction.getVersion();
    }

    @Override
    public Appendix.Message getMessage() {
        return transaction.getMessage();
    }

    @Override
    public Appendix.PrunablePlainMessage getPrunablePlainMessage() {
        return transaction.getPrunablePlainMessage();
    }

    @Override
    public Appendix.EncryptedMessage getEncryptedMessage() {
        return transaction.getEncryptedMessage();
    }

    @Override
    public Appendix.PrunableEncryptedMessage getPrunableEncryptedMessage() {
        return transaction.getPrunableEncryptedMessage();
    }

    public Appendix.EncryptToSelfMessage getEncryptToSelfMessage() {
        return transaction.getEncryptToSelfMessage();
    }

    @Override
    public Appendix.Phasing getPhasing() {
        return transaction.getPhasing();
    }

    @Override
    public List<? extends Appendix> getAppendages() {
        return transaction.getAppendages();
    }

    @Override
    public List<? extends Appendix> getAppendages(boolean includeExpiredPrunable) {
        return transaction.getAppendages(includeExpiredPrunable);
    }

    @Override
    public int getECBlockHeight() {
        return transaction.getECBlockHeight();
    }

    @Override
    public long getECBlockId() {
        return transaction.getECBlockId();
    }

    @Override
    public short getIndex() {
        return transaction.getIndex();
    }
}