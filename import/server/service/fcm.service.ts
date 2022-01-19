import { LogUtil, ServerUtil } from "../lib";
import { Users, FCMCollection } from "../collections";
import { ReadPref, FCM, ResultCode, FMCMessage } from "../models";

export class _FCMService {
    
    // 유저의 fcm 토큰값을 저장한다. 로그인이 되어있다면 web의 appcomponent 에서 실행
    async saveUserToken(userId : string, fcmToken : string){
        if(!userId || !fcmToken){
            LogUtil.error({ e: 'saveUserToken() param is undefined. ' + userId + ' ////// Token : ' + fcmToken});
            return;
        }

        let token = fcmToken;

        let result;

        try {
            let userfcm = await FCMCollection.findOneSecondary({owner : userId});
            
            if(!userfcm || userfcm.length <= 0){
                let fcm : FCM = {
                    owner : userId,
                    key : token,
                    badge : 0
                }
                
                result = await FCMCollection.insert(fcm);
            } else {
                if(userfcm.key == token){
                    // 통과 (굳이 update 안해도됨.)
                } else {
                    // fcm 키가 변경되었을 시 대체한다.
                    await FCMCollection.update({owner : userId},{$set : {key : token}});
                    // update
                    return;
                }
            }

            // 뱃지도 reset
            
        } catch (err) {
            LogUtil.error({e : 'saveUserToken() update failed. exception : ' + err.message});
            return;
        }

        return 'suc';
    }

    initMessageObject(){
        // notification : 알림메시지, 내용
        // token : 메시지를 받을 유저의 앱token 값 (to)
        let result : FMCMessage = {
            notification : {
                body:'',
                title:''
            },
            token:'',
            data : {
                title : '',
                body : ''
            },
        }

        return result;
    }

    async getFCMKey(userId : string){
        return await FCMCollection.findOneSecondary({owner : userId});
    }

    // 거래체결알림
    async pushTradeAlert(trade : any){
        if(!trade || !trade.orderOwner || !trade.owner){
            return undefined;
        }

        let ownerFcm = await this.getFCMKey(trade.owner);
        let orderOwnerFcm = await this.getFCMKey(trade.orderOwner);

        let messageObject = this.initMessageObject();
        
        // 안드로이드 foreground 일때는 data 안에서 title 과 body 를 찾게되므로 둘다 세팅해준다.
        if(ownerFcm && ownerFcm.key){
            messageObject.token = ownerFcm.key;
            let tradeGb = trade.kind == 'buy' ? '매수' : '매도';

            messageObject.data.title = 'VENTASBIT_체결알림 : ' + trade.target + '/' + trade.src;
            messageObject.data.body = trade.target + '/' + trade.src + ' ' + tradeGb + '체결 (' + trade.amount + ' ' + trade.target +')';
            messageObject.notification.title = 'VENTASBIT_체결알림 : ' + trade.target + '/' + trade.src;
            messageObject.notification.body = trade.target + '/' + trade.src + ' ' + tradeGb + '체결 (' + trade.amount + ' ' + trade.target +')';

            let pushResult = await ServerUtil.pushMessage(messageObject);
            if(pushResult != ResultCode.SUC){
                LogUtil.error({e : 'pushTradeAlert failed to owner. ' + trade});
            }
        }

        if(orderOwnerFcm && orderOwnerFcm.key){
            messageObject.token = orderOwnerFcm.key;
            let tradeGb = trade.kind == 'buy' ? '매도' : '매수';

            messageObject.data.title = 'VENTASBIT_체결알림 : ' + trade.target + '/' + trade.src;
            messageObject.data.body = trade.target + '/' + trade.src + ' ' + tradeGb + '체결 (' + trade.amount + ' ' + trade.target +')';
            messageObject.notification.title = 'VENTASBIT_체결알림 : ' + trade.target + '/' + trade.src;
            messageObject.notification.body = trade.target + '/' + trade.src + ' ' + tradeGb + '체결 (' + trade.amount + ' ' + trade.target +')';

            let pushResult = await ServerUtil.pushMessage(messageObject);
            if(pushResult != ResultCode.SUC){
                LogUtil.error({e : 'pushTradeAlert failed to owner. ' , trade : trade});
            }
        }
    }

    // 내부이체 알림
    /**
     * 
     * @param transfers : [0] : 출금내부이체row , [1] : 입금내부이체row
     */
    async pushInternalTransferAlert(transfers : any){
        if(!transfers[0] || !transfers[1] || !transfers[0].owner || transfers[0].status != 104 || !transfers[0].assetCode || !transfers[0].kind ||
            !transfers[1].owner || transfers[1].status != 104 || !transfers[1].assetCode || !transfers[1].kind){
            return;
        }

        let withdrawTransfer = transfers[0];
        let depositTransfer = transfers[1];
        let withdrawTransferOwnerFCM = await this.getFCMKey(withdrawTransfer.owner);
        let depositTransferOwnerFCM = await this.getFCMKey(depositTransfer.owner);

        let messageObject = this.initMessageObject();
        messageObject.notification.title = 'VENTASBIT_내부이체알림';
        messageObject.data.title = 'VENTASBIT_내부이체알림';

        let assetCode;
        let amount;

        if(withdrawTransferOwnerFCM && withdrawTransferOwnerFCM.key){
            messageObject.token = withdrawTransferOwnerFCM.key;

            assetCode = withdrawTransfer.assetCode;
            amount = withdrawTransfer.amount;

            messageObject.notification.body = withdrawTransfer.toAddress + ' 에게 ' + amount + ' ' + assetCode + ' 송금하였습니다.';
            messageObject.data.body = withdrawTransfer.toAddress + ' 에게 ' + amount + ' ' + assetCode + ' 송금하였습니다.';

            let pushResult = await ServerUtil.pushMessage(messageObject);
            if(pushResult != ResultCode.SUC){
                LogUtil.error({e : 'pushInternalTransferAlert failed to withdrawTransferOwner. ' , transfer : withdrawTransfer });
            }
        }
        
        if(depositTransferOwnerFCM && depositTransferOwnerFCM.key){
            messageObject.token = depositTransferOwnerFCM.key;

            assetCode = depositTransfer.assetCode;
            amount = depositTransfer.amount;

            messageObject.notification.body = depositTransfer.fromAddress + ' 로 부터 ' + amount + ' ' + assetCode + ' 입금되었습니다.';
            messageObject.data.body = depositTransfer.fromAddress + ' 로 부터 ' + amount + ' ' + assetCode + ' 입금되었습니다.';

            let pushResult = await ServerUtil.pushMessage(messageObject);
            if(pushResult != ResultCode.SUC){
                LogUtil.error({e : 'pushInternalTransferAlert failed to depositTransferOwner. ' , transfer : depositTransfer });
            }
        }
    }

    // 입금신청 알림

}
export const FCMService = new _FCMService();