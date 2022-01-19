import { TransferService } from "./transfer.service";
import { ResultCode, EventTrading } from "../models";
import { LogUtil, DecimalUtil } from "../lib";
import { ENGINE_METHOD_DIGESTS } from "constants";
import { Users, EventTradingCollection, EventListCollection } from "../collections";
import { UserWalletService } from "./user.wallet.service";


export class _EventService {
/*     // 회원가입시 KRW 5000원 지급 이벤트
    async receive5000KRW(email: string) {
        let now = new Date();
        let stDt = new Date('2018-12-03 14:00:00');
        let enDt = new Date('2019-01-02 14:00:00');

        if (now.getTime() < stDt.getTime()) {
            return { code: ResultCode.SUC }
        } else if (enDt.getTime() < now.getTime()) {
            return { code: ResultCode.SUC }
        }

        if (!email) {
            LogUtil.error({ e: 'receive5000KRW(): email is undefined.' })
            return { code: ResultCode.ERROR }
        }

        let transferInfo = {
            email: email,
            assetCode: 'KRW',
            amount: 5000
        }

        let internalTransfer = await TransferService.initInternalTransfer(transferInfo, true, '신규회원가입');
        let result = await TransferService.createInternalTransfer(internalTransfer, true);

        if (!result || result.code != 200) {
            LogUtil.error({ e: 'receive5000KRW(): createInternalTransfer is failed.' })
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }

    // 회원 추천인 이벤트
    async send2000KRW(targetEmail: string) {
        let now = new Date();
        let stDt = new Date('2018-12-05 14:00:00');
        let enDt = new Date('2019-01-04 14:00:00');

        if (now.getTime() < stDt.getTime()) {
            return { code: ResultCode.SUC }
        } else if (enDt.getTime() < now.getTime()) {
            return { code: ResultCode.SUC }
        }

        if (!targetEmail) {
            LogUtil.error({ e: 'send2000KRW(): email is undefined.' })
            return { code: ResultCode.ERROR }
        }

        let transferInfo = {
            email: targetEmail,
            assetCode: 'KRW',
            amount: 2000
        }

        let internalTransfer = await TransferService.initInternalTransfer(transferInfo, true, '가입추천');
        let result = await TransferService.createInternalTransfer(internalTransfer, true);

        if (!result || result.code != 200) {
            LogUtil.error({ e: 'send2000KRW(): createInternalTransfer is failed.' })
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    } */

    recommenderAliasCode() {
        let recommenderCode = '';
        let randomStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*1234567890";
        for (let i = 0; i < 6; i++) {
            let randomInt = Math.floor(Math.random() * 100) % 70;
            recommenderCode += randomStr.charAt(randomInt);
        }
        return recommenderCode;
    }
    createUserAlias() {
        let cnt = 0;
        let userAliasCode = '';
        do {
            userAliasCode = this.recommenderAliasCode();
            let alise = Users.findOne({ 'profile.alias': userAliasCode });
            if (alise) {
                cnt = cnt + 1; // 10회 반복
            } else {
                cnt = 10;//종료
            }
        } while (cnt < 10);
        return userAliasCode;
    }

    /* (19-05-24 ~ 19-06-28) 벤타스코인 보유량 이벤트 시작 */
    // 이벤트 신청 버튼
    public async createAssetEvent(eventNo: string, limit: number, userId: string) {
        if (!eventNo || !Number(limit) || !userId) {
            LogUtil.error({ e: 'initVencAssetEvent(): param is undefined. ', eventNo, limit, userId });
            return { code: ResultCode.ERROR };
        }

        let event;

        try {
            let myEventHistory = await this.getMyEventHistory(eventNo, limit, userId)
            if (myEventHistory) {
                return { code: ResultCode.ERROR };
            }

            let eventInfo = await this.getEventInfo(eventNo);

            let nowDt = new Date();
            
            if (!eventInfo || !eventInfo.enDt || !eventInfo.stDt || eventInfo.enDt < nowDt || nowDt < eventInfo.stDt || !eventInfo.targets[0]) {
                LogUtil.error({ e: 'initVencAssetEvent(): eventInfo is invalid. ', eventInfo });
                return { code: ResultCode.ERROR };
            }
            
            let eventBalance = await this.getEventBalance(eventInfo.targets[0], userId, eventInfo.stDt);
            if (eventBalance.eventBalance < limit) {
                LogUtil.error({ e: 'initAssetEvent() eventBalance is lack.: ', eventBalance, limit });
                return { code: ResultCode.ERROR, msg: 'eventBalance is lack.', eventBalance };
            }

            event = {
                eventNo: eventNo,
                limit: limit,
                assetCode: eventInfo.targets[0],
                walletBalance: eventBalance.walletBalance,
                eventBalance: eventBalance.eventBalance
            }

            let result = await this.insertEventValue(event);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'initVencAssetEvent(): insert EventValue is failed. ', event });
                return { code: ResultCode.ERROR };
            }

        } catch (err) {
            LogUtil.error({ e: 'initVencAssetEvent(): ' + err.message, eventNo, userId });
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC };
    }
    // 이벤트 참여기록이 있는지 확인
    public async getMyEventHistory(eventNo: string, limit: number, userId: string) {
        if (!eventNo || !Number(limit) || !userId) {
            LogUtil.error({ e: 'getMyEventHistory(): param is undefined. ', eventNo, limit, userId });
            return undefined;
        }

        let myEventHistory;
        try {
            myEventHistory = await EventTradingCollection.findOneSecondary({ eventNo: eventNo, inUser: userId, limit: limit });
        } catch (err) {
            LogUtil.error({ e: 'getMyEventHistory(): ' + err.message, eventNo, limit, userId });
            return undefined;
        }

        return myEventHistory;
    }
    // 이벤트 정보 리턴
    public async getEventInfo(eventNo: string) {
        if (!eventNo) {
            LogUtil.error({ e: 'getEventInfo(): param is undefined. ' });
            return undefined;
        }

        let eventInfo;
        try {

            eventInfo = await EventListCollection.findOneSecondary({ eventNo: eventNo });

        } catch (err) {
            LogUtil.error({ e: 'getEventInfo(): ' + err.message, eventNo });
            return undefined;
        }

        return eventInfo;
    }
    // 이벤트 
    public async getEventBalance(assetCode: string, userId: string, stDt: Date) {
        if (!assetCode || !userId || !stDt) {
            LogUtil.error({ e: 'getEventBalance(): param is undefined. ', assetCode, userId, stDt });
            return { eventBalance: 0, walletBalance: 0 };
        }

        let eventBalance = 0;
        let walletBalance = 0;
        let userWallet;
        
        try {
            userWallet = await UserWalletService.getUserWallet(userId, assetCode);
            
            let myDepositSum = await TransferService.getMyDepositSum(assetCode, userId, stDt);
            
            walletBalance = userWallet.balance;
            
            eventBalance = DecimalUtil.sub(userWallet.balance, myDepositSum);
        } catch (err) {
            LogUtil.error({ e: 'getEventBalance(): ' + err.message, assetCode, userId, stDt });
            return { eventBalance: 0, walletBalance: 0 };
        }

        return { eventBalance: eventBalance, walletBalance: walletBalance };
    }
    // 이벤트 기록 추가
    private async insertEventValue(event: EventTrading) {
        if (!event) {
            LogUtil.error({ e: 'insertEventValue(): event is undefined. ' });
            return { code: ResultCode.ERROR }
        }

        try {

            let result = await EventTradingCollection.insert(event).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'insertEventValue(): insert event is failed. ', event });
                return { code: ResultCode.ERROR }
            }

        } catch (err) {
            LogUtil.error({ e: 'insertEventValue(): ' + err.message, event });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }
    /* (19-05-24 ~ 19-06-28) 벤타스코인 보유량 이벤트 끝 */
}
export const EventService = new _EventService();