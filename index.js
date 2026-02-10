// ৪. মেইন ইভেন্ট প্রসেসর
async function processEvent(data, docId, collectionName) {
  // ১. এখানে 'edit' ভেরিয়েবলটি destructure করা হলো
  const { status, method, amount, trxId, requestId, notified, bankid, note, region, reason, name, edit } = data;

  if (!status || !method) return;
  if (notified === status) return;
  if (!['pending', 'approved', 'rejected'].includes(status)) return;

  const number = data.Number || data.number || 'N/A';
  const customId = data.id || docId;
  const isWithdraw = collectionName === 'withdrawRequests';

  try {
    const snap = await db.collection('musers').where('payment', '==', method).get();
    if (snap.empty) {
        console.log(`⚠️ No manager found for method: ${method}`);
        return;
    }

    const manager = snap.docs[0].data();
    const chatId = manager.chatId;
    if (!chatId) return;

    let msg = '';

    if (!isWithdraw) {
      // ==== ডিপোজিট সেকশন ====
      const bdtAmount = parseFloat(amount);
      const formattedBDT = bdtAmount.toFixed(2);

      if (status === 'approved') {
        // ✅ DEPOSIT APPROVED (Updated with Comment logic)
        // ২. লজিক: যদি edit থাকে তাহলে নতুন লাইনে Comment দেখাবে, না থাকলে দেখাবে না।
        msg = `APPROVED 
BankTransfer Agents
Deposit Request № ${requestId || 'N/A'}
Agent: ${method}
Payment number: ${number}
Amount: ${bdtAmount} BDT
Customer: ${customId} ${name || ''}${edit ? `\nComment: ${edit}` : ''}
Ext_trn_id: ${trxId || 'N/A'}`;

      } else if (status === 'pending') {
        // ⏳ DEPOSIT PENDING
        msg = `BankTransfer Agents
Deposit Request № ${requestId || 'N/A'}
Agent:  ${method} 
Payment number: ${number}
Amount: ${formattedBDT} BDT 
Customer: ${customId} (${name || 'N/A'})
ChatId - ${chatId}
id: ${bankid || 'N/A'}
ext_trn_id: ${trxId || 'N/A'}
${note || ''}`;

      } else {
        // ❌ DEPOSIT REJECTED
        msg = `REJECTED
BankTransfer Agents
Deposit Request № ${requestId || 'N/A'}
Agent: ${method}
Payment number: ${number}
Amount: ${formattedBDT} BDT 
Customer: ${customId} ${name || ''}
BankTransferComment: ${region || 'N/A'}
Ext_trn_id: ${trxId || 'N/A'}`;
      }

    } else {
      // ==== উইথড্র সেকশন ====
      if (status === 'approved') {
        // ✅ SENT (Approved)
        msg = `SENT
BankTransfer Agents
Withdrawal Request № ${requestId || 'N/A'}
Agent: ${method}
Payment number: ${number}
Amount: ${amount} BDT
Customer: ${customId} ${name || ''}
BankTransferComment: ${trxId || 'N/A'}`;

      } else if (status === 'pending') {
        // ⏳ PENDING
        msg = `BankTransfer Agents
Withdrawal Request № ${requestId || 'N/A'}
Agent: ${method}
Payment number: ${number}
Amount: ${amount} BDT 
Customer: ${customId} (${name || 'N/A'})
- User data -
id: ${bankid || 'N/A'}
${note || 'Wallet Number'}: ${number}`;

      } else {
        // ❌ REJECTED (CANCELED)
        msg = `CANCELED
BankTransfer Agents
Withdrawal Request № ${requestId || 'N/A'}
Agent: ${method}
Payment number: ${number}
Amount: ${amount} BDT 
Customer: ${customId} ${name || ''}
BankTransferComment: ${reason || 'N/A'}`;
      }
    }

    const sent = await sendTelegramMessage(chatId, msg);

    if (sent) {
      await db.collection(collectionName).doc(docId).update({
        notified: status
      });
      console.log(`✅ Notification updated for ${docId} [${status}]`);
    }
  } catch (err) {
    console.error('❌ Error processing event:', err.message);
  }
}
