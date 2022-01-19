import { LogUtil, ServerUtil, DecimalUtil } from "../lib";
import { Users, TransferCollection } from "../collections";
import { Transfer, TransferStatus, ResultCode, UserWalletHistoryType, User, ReadPref } from "../models";
import { UserWalletService } from "./user.wallet.service";
import { CompanyAssetService } from "./companyasset.service";
import { UserService } from "./user.service";
import { CoinService } from "./coin.service";
import { UserInfoHistoryService } from "./user.info.history.service";
import { FCMService } from "./fcm.service";


export class _TransferService {

    /**
     * @param receivedTransfer = { kind: string, toAddress: string, assetCode: string, amount: number, userId: string, txId?: string, networkFee?: number, destTag?: string}
    */
    private async initTransfer(receivedTransfer: any) {
        if (!receivedTransfer
            || !receivedTransfer.kind || (receivedTransfer.kind != 'withdraw' && receivedTransfer.kind != 'deposit')
            || !receivedTransfer.toAddress
            || !receivedTransfer.assetCode
            || !Number(receivedTransfer.amount) || Number(receivedTransfer.amount) < 0 || Number(receivedTransfer.amount) > 10000000000
            || !receivedTransfer.userId) {
            LogUtil.error({ e: 'initTransfer(): Invalid Param.', receivedTransfer });
            return undefined;
        }

        LogUtil.info({ i: ' initTransfer. ', receivedTransfer }, true);

        let user = Users.findOne({ _id: receivedTransfer.userId });
        if (!user) {
            LogUtil.error({ e: 'initTransfer(): user is undefined.' });
            return undefined;
        }

        let transfer: Transfer = {
            kind: receivedTransfer.kind,
            owner: user['_id'],
            ownerName: user['profile'].username,
            ownerEmail: user['emails'][0].address,
            fromAddress: '',
            toAddress: receivedTransfer.toAddress,
            addressType: 'external',
            assetCode: receivedTransfer.assetCode,
            status: TransferStatus.UNCONFIRMED,
            amount: Number(receivedTransfer.amount),
            ownerFee: 0,
            fee: 0,
            totalAmount: Number(receivedTransfer.amount),
            tId: 't' + await ServerUtil.getNextSeq('transfer' + receivedTransfer.assetCode),
            txId: receivedTransfer.txId ? receivedTransfer.txId : undefined,
            networkFee: receivedTransfer.networkFee ? receivedTransfer.networkFee : 0,
            destTag: receivedTransfer.destTag ? receivedTransfer.destTag : undefined,
            country: receivedTransfer.country ? receivedTransfer.country : ''
        }

        // KRW 입, 출금일 경우 은행 계좌 정보 추가. 
        if (transfer.assetCode == 'KRW') {
            transfer.bankNo = user['profile'].bankInfo.no;
            transfer.bankName = user['profile'].bankInfo.name;
            transfer.bankCode = user['profile'].bankInfo.code;
            transfer.ownerName = user['profile'].bankInfo.ownerName;
        }

        if (transfer.kind == 'deposit') {
            return transfer;
        }

        // 코인 내부 이체 일 경우.
        // KRW는 web에서 내부 이체 처럼 요청을 하기도 하므로 패스.
        if (UserWalletService.isInternalAddress(receivedTransfer.toAddress, receivedTransfer.assetCode) && receivedTransfer.assetCode != 'KRW') {
            transfer.addressType = 'internal';
            return transfer;
        }

        if (transfer.kind == 'withdraw') {
            transfer.fee = this.getTransferFee(transfer.assetCode);
            transfer.fromAddress = this.getFromaddress(transfer.assetCode, user['_id']);
            transfer.totalAmount = DecimalUtil.add(transfer.totalAmount, transfer.fee);
        }

        return transfer;
    }

    private getTransferFee(assetCode: string) {
        if (!assetCode) {
            return 0;
        }

        let companyAsset = CompanyAssetService.getCompanyAssetWithTarget(assetCode);

        if (!companyAsset || !Number(companyAsset.withdrawFee)) {
            return 0;
        }

        return Number(companyAsset.withdrawFee);
    }

    private getFromaddress(assetCode: string, userId: string) {
        if (!assetCode || !userId) {
            return undefined;
        }

        let userWallet = UserWalletService.getUserWallet(userId, assetCode);

        if (!userWallet) {
            return undefined;
        }

        return userWallet.address;
    }


    /**
     * @param receivedTransfer = { kind: string, toAddress: string, assetCode: string, amount: number, userId: string, txId?: string, networkFee?: number, destTag?: string}
    */
    public async createTransfer(receivedTransfer: any) {
        if (!Meteor.userId()) {
            return { code: ResultCode.ERROR }
        }
        receivedTransfer.userId = Meteor.userId();
        let transfer = await this.initTransfer(receivedTransfer);

        if (!transfer || !transfer.owner || !transfer.assetCode || !Number(transfer.totalAmount)) {
            LogUtil.error({ e: 'createTransfer(): invalid param.', transfer });
            return { code: ResultCode.ERROR };
        }

        if (transfer.addressType == 'internal') {
            let targetEmail = UserWalletService.getEmailByWalletAddress(transfer.assetCode, transfer.toAddress);
            return this.createInternalTransfer({
                userId: transfer.owner,
                assetCode: transfer.assetCode,
                amount: transfer.amount,
                email: targetEmail,
                toAddress: transfer.toAddress
            });
        }

        let result;
        let _id;

        try {
            // 출금의 경우, 자산이 없으면 transfer 생성 x.
            if (transfer.kind == 'withdraw') {
                let userWallet = UserWalletService.getUserWallet(transfer.owner, transfer.assetCode);

                if (!userWallet || userWallet.available < transfer.totalAmount) {
                    LogUtil.error({ e: 'createTransfer(): available is lack.', transfer });
                    return { code: ResultCode.ERROR };
                }
            }

            result = await TransferService.insertTransfer(transfer);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'createTransfer(): inserting transfer is failed.' })
                return { code: ResultCode.ERROR };
            }
            _id = result._id;

            if (transfer.kind == 'deposit') {
                return { code: ResultCode.SUC };
            }

            let walletLedger = UserWalletService.initWalletLedger({
                owner: transfer.owner,
                assetCode: transfer.assetCode,
                balance: 0,
                available: - transfer.totalAmount
            })

            result = await UserWalletService.updateBalance(walletLedger, UserWalletHistoryType.transfer,'transfer');
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'createTransfer(): updating balance is failed.' })
                return { code: ResultCode.ERROR };
            }

            if (transfer.assetCode == 'KRW') {
                return { code: ResultCode.SUC, _id: _id };
            }

            result = await CoinService.sendCoin(transfer.assetCode, transfer.toAddress, transfer.amount, transfer.owner, _id, transfer.destTag);
            if (!result || result.code != 200) {
                return { code: ResultCode.ERROR };
            }

        } catch (err) {
            LogUtil.error({ e: 'createTransfer(): ' + err.message })
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC, _id: _id };
    }

    private async insertTransfer(transfer: Transfer) {
        if (!transfer) {
            LogUtil.error({ e: 'insertTransfer(): invalid param.' });
            return { code: ResultCode.ERROR };
        }
        let result;
        try {

            result = await TransferCollection.insert(transfer).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'insertTransfer(): inserting transfer is failed.' });
                return { code: ResultCode.ERROR };
            }
            try {
                await UserInfoHistoryService.pushUserTransfer(result);
            } catch (error) {
                LogUtil.error({ e: 'pushUserTransfer(): pushUserTransfer transfer is failed.' });
            }

        } catch (err) {
            LogUtil.error({ e: 'insertTransfer()' + err.message });
            return { code: ResultCode.ERROR };
        }

        LogUtil.info({ i: ' new transfer: ', transfer }, true);

        return { code: ResultCode.SUC, _id: result };
    }

    /**
     * @param receivedTransfer = {userId: string, assetCode: string, amount: number, email: string, toAddress?: string}
     * @param isVentasAssetId
     * @param eventMsg 
     */
    private async initInternalTransfer(receivedTransfer: any, eventMsg?: string) {
        if (!receivedTransfer
            || !receivedTransfer.userId
            || !receivedTransfer.assetCode
            || !Number(receivedTransfer.amount)
            || !receivedTransfer.email) {

            LogUtil.error({ e: 'initInternalTransfer(): Invalid param.', receivedTransfer });
            return undefined;
        }

        LogUtil.info({ i: ' initTransfers: ', receivedTransfer, eventMsg }, true);

        let user = UserService.getUserById(receivedTransfer.userId);
        let targetUser = UserService.getUserByEmail(receivedTransfer.email);

        if (!user || !targetUser) {
            LogUtil.error({ e: 'initInternalTransfer() : user is undefined.', receivedTransfer });
            return undefined;
        }

        // 본인에게 내부이체 불가.        
        if (user.emails[0].address == targetUser.emails[0].address) {
            LogUtil.error({ e: 'initInternalTransfer() : cant send to myself.', receivedTransfer });
            return undefined;
        }

        let withdrawTransfer: Transfer = {
            kind: 'withdraw',
            owner: user._id,
            ownerName: user.profile.username,
            ownerEmail: user.emails[0].address,
            fromAddress: user.emails[0].address,
            toAddress: receivedTransfer.toAddress ? receivedTransfer.toAddress : targetUser.emails[0].address,
            addressType: 'internal',
            assetCode: receivedTransfer.assetCode,
            status: TransferStatus.COMPLETE,
            amount: Number(receivedTransfer.amount),
            ownerFee: 0,
            fee: 0,
            totalAmount: Number(receivedTransfer.amount),
            tId: 't' + await ServerUtil.getNextSeq('transfer' + receivedTransfer.assetCode),
            inDt: new Date(),
            confirmDt: new Date(),
            confirmUser: eventMsg ? eventMsg : '내부이체',
            approvalDt: new Date(),
            approvalUser: eventMsg ? eventMsg : '내부이체',
            country: receivedTransfer.country ? receivedTransfer.country : ''
        }

        let depositTransfer: Transfer = {
            kind: 'deposit',
            owner: targetUser._id,
            ownerName: targetUser.profile.username,
            ownerEmail: targetUser.emails[0].address,
            fromAddress: user.emails[0].address,
            toAddress: receivedTransfer.toAddress ? receivedTransfer.toAddress : targetUser.emails[0].address,
            addressType: 'internal',
            assetCode: receivedTransfer.assetCode,
            status: TransferStatus.COMPLETE,
            amount: Number(receivedTransfer.amount),
            ownerFee: 0,
            fee: 0,
            totalAmount: Number(receivedTransfer.amount),
            tId: 't' + await ServerUtil.getNextSeq('transfer' + receivedTransfer.assetCode),
            inDt: new Date(),
            confirmDt: new Date(),
            confirmUser: eventMsg ? eventMsg : '내부이체',
            approvalDt: new Date(),
            approvalUser: eventMsg ? eventMsg : '내부이체',
            country: receivedTransfer.country ? receivedTransfer.country : ''
        }

        return [withdrawTransfer, depositTransfer]
    }

    public async createInternalTransfer(receivedTransfer: any, eventMsg?: string) {
        let transfers = await this.initInternalTransfer(receivedTransfer, eventMsg);

        if (!transfers || !transfers[0] || !transfers[1]) {
            LogUtil.error({ e: 'createInternalTransfer() : param is invalid.' });
            return { code: ResultCode.ERROR }
        }

        let result;
        let walletLedger;

        try {
            // 자산이 없으면 transfer 생성 x.            
            let userWallet = UserWalletService.getUserWallet(transfers[0].owner, transfers[0].assetCode);            

            if (!userWallet || userWallet.available < transfers[0].totalAmount) {
                LogUtil.error({ e: 'createTransfer(): available is lack.', transfers: transfers });
                return { code: ResultCode.ERROR };
            }

            // 보내는 사람 지갑에서 balance, available 빼고
            result = await this.insertTransfer(transfers[0]);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'createInternalTransfer() : insertTransfer 0 is failed.', transfer: transfers[0] });
                return { code: ResultCode.ERROR }
            }

            walletLedger = UserWalletService.initWalletLedger({
                owner: transfers[0].owner,
                assetCode: transfers[0].assetCode,
                balance: - Number(transfers[0].totalAmount),
                available: - Number(transfers[0].totalAmount)
            });


            result = await UserWalletService.updateBalance(walletLedger, UserWalletHistoryType.transfer,'transfer');
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'createInternalTransfer() : updateBalance 0 is failed.', walletLedger });
                return { code: ResultCode.ERROR }
            }

            // 받는 사람 지갑에 balance, available 더하고
            result = await this.insertTransfer(transfers[1]);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'createInternalTransfer() : insertTransfer 1 is failed.', transfer: transfers[1] });
                return { code: ResultCode.ERROR }
            }

            walletLedger = UserWalletService.initWalletLedger({
                owner: transfers[1].owner,
                assetCode: transfers[1].assetCode,
                balance: Number(transfers[1].totalAmount),
                available: Number(transfers[1].totalAmount)
            });

            result = await UserWalletService.updateBalance(walletLedger, UserWalletHistoryType.transfer,'transfer');
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'createInternalTransfer() : updateBalance 1 is failed.', walletLedger });
                return { code: ResultCode.ERROR }
            }

        } catch (err) {
            LogUtil.error({ e: 'createInternalTransfer(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        // 알람이 가야할 경우 알람을 보내줌
        FCMService.pushInternalTransferAlert(transfers);

        return { code: ResultCode.SUC };
    }

    async getMyTransferList(userId: string, assetCode: string, kind: string, limit: number = 30, fromDt?: Date, atDt?: Date) {
        let myTransferList = [];

        if(!assetCode || assetCode == '자산 전체'){
            assetCode = '';
        }

        if(!kind || kind == '거래 전체'){
            kind = '';
        }else if(kind == '입금'){
            kind = 'deposit';
        }else if(kind == '출금'){
            kind = 'withdraw';
        }

        
        try {
            if (fromDt && atDt) {
                myTransferList = await TransferCollection.find({ owner: userId, assetCode: { $regex : assetCode, $options: 'i' }, kind: { $regex : kind, $options: 'i' }, inDt: { $gt: fromDt, $lte: atDt } }, { sort: { inDt: -1 }, limit: limit, readPreference: ReadPref.SECONDARY_PREFERRED });
            } else {
                myTransferList = await TransferCollection.find({ owner: userId, assetCode: { $regex : assetCode, $options: 'i' }, kind: { $regex : kind, $options: 'i' } }, { sort: { inDt: -1 }, limit: limit, readPreference: ReadPref.SECONDARY_PREFERRED });
            }
        } catch (err) {
            LogUtil.error({ e: 'getMyTransferList(): ' + err.message });
            return [];
        }

        return myTransferList;
    }

    async getMyLatelyTransferList(assetCode : string, ){
        let list = [];
        if(!Meteor.userId()){
            return
        }
        try {
            list = await TransferCollection.find({owner : Meteor.userId() , assetCode : assetCode , kind : 'withdraw' , addressType : 'external' , status : 104},{sort : {inDt : -1}});
        } catch (err) {
            LogUtil.error({ e: 'getMyLatelyTransferList(): ' + err.message });
            return [];
        }
        return list;
    }

    // 사용자의 진행중인 이체내역 확인 (회원탈퇴관련)
    public async checkProceedingTransfer(_id : string){
        let proceedingTransfer;
    
        let result = false;
    
        if(!_id){
            LogUtil.error({ e: 'check_ProceedingTransfer(): param is undefined.' });
            return result;
        }
    
        try {
            proceedingTransfer = await TransferCollection.findOneSecondary({ $and : [ { owner : _id } , { $or : [ { status : 101 } , { status:102 } ] } ] });
            
            if(!proceedingTransfer){
                result = true;
            }
    
        } catch (err) {
            LogUtil.error({ e: 'check_ProceedingTransfer(): db exception.. ' + err.message });
            result = false;
            return result;
        }
        
        return result;
    }

    // 2019-05-24 ~ 2019-06-28 VENC 보유량 이벤트 관련함수. 입금 내역값 리턴
    public async getMyDepositSum(assetCode: string, userId: string, stDt?: Date){
        if (!assetCode || !userId) {
            LogUtil.error({ e: 'getMyDepositSum(): param is undefined.', assetCode, userId, stDt });
            return 0;
        }

        let myDepositList = [];
        let myDepositSum = 0;

        try {
            myDepositList = await TransferCollection.find({ assetCode: assetCode, owner: userId, status: 104, kind: 'deposit', approvalDt: { $gte: stDt } }, { readPreference: ReadPref.SECONDARY_PREFERRED })

            for(let i = 0; i < myDepositList.length; i++){
                myDepositSum = DecimalUtil.add(myDepositSum, myDepositList[i].totalAmount);
            }
            
        } catch (err) {
            LogUtil.error({ e: 'getMyDepositSum(): ' + err.message, assetCode, userId, stDt });
            return 0;
        }

        return myDepositSum;        
    }

    async getMyLastDepositTransfer(userId : string){
        if(!userId){
            LogUtil.error({e : 'getMyLastDepositTransfer(). invalid param.'});
            return undefined;
        }

        let lastTransfer;
        let now = Date.now();
        let gap = 259200000; // 3일 (72시간)

        try {
            lastTransfer = await TransferCollection.findOneSecondary({ kind:"deposit", status:104, owner : userId }, {sort : { approvalDt : -1 } , readPreference : ReadPref.SECONDARY_PREFERRED });
            if(!lastTransfer || !lastTransfer._id || !lastTransfer.approvalDt){
                // 입금내역이 없다면 출금못하도록 false 리턴
                return false;
            }

            if((now - lastTransfer.approvalDt.getTime()) < gap){
                // 마지막 입금으로부터 3일 이내일경우 출금불가
                return false;
            }
        } catch (err) {
            LogUtil.error({e : 'getMyLastDepositTransfer(). exception. err : ' + err.message});
            return undefined;
        }

        // return : boolean .   false = 출금불가, true = 출금가능
        return true;
    }
}
export const TransferService = new _TransferService();