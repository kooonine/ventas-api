import { CertsColls } from "../collections";
import { Cert, ResultCode } from "../models";
import { ServerUtil, LogUtil } from "../lib";


Meteor.methods({
    async sendSMS() {
        let user = Meteor.user();

        if (!user || !user.profile.phoneNo) {
            return { code: ResultCode.ERROR }
        }

        let cert = {
            certNo: ServerUtil.randomNum(6),
            userId: Meteor.userId(),
            target: user.profile.phoneNo,
            certYn: false,
            certType: 'SMS',
        }
        let certId;
        try {
            certId = await CertsColls.insert(cert).first().toPromise();
        } catch (err) {
            LogUtil.error({ e: 'sendSMS(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        const SENDER = Meteor.settings.private.ppurio.sender1;
        const CMID = ServerUtil.getLocaleDate();
        const MSG_BODY = '[벤타스비트 본인 확인] \n인증번호[' + cert.certNo + ']를 화면에 입력해주세요.';
        const QUERY = "INSERT INTO biz_msg( MSG_TYPE, CMID, REQUEST_TIME, SEND_TIME, DEST_PHONE, SEND_PHONE, MSG_BODY) VALUES (0, '" + CMID + "', NOW(), NOW(), '" + user.profile.phoneNo + "', '" + SENDER + "', '" + MSG_BODY + "') ";
        let mysqlClient = ServerUtil.getMysqlClient();
        try {
            mysqlClient.connect();

            mysqlClient.query(QUERY, (err, results, fields) => {
                if (err) {
                    throw err;
                }
            });
        } catch (err) {
            LogUtil.error({ e: 'sendSMS(): ' + err.message });
            return { code: ResultCode.ERROR };
        } finally {
            mysqlClient.end();
        }
        return { code: ResultCode.SUC, certId: certId };
    },
    checkCertNo(certId: string, certNo: number) {
        if (!Meteor.userId() || !certNo || !certId) {
            return { code: ResultCode.ERROR }
        }

        let cert = CertsColls.findOne({ _id: certId, certYn: false });
        if (!cert) {
            return { code: ResultCode.ERROR }
        }

        if (String(certNo) != cert.certNo) {
            return { code: ResultCode.ERROR }
        }

        CertsColls.update(cert, { certYn: true });

        return { code: ResultCode.SUC }
    }
});