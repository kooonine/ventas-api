import { ServerUtil, LogUtil } from "../lib";
import { BankCode, TransferReqMsg, BankIdentificationCode, ResultCode, Cert, ReadPref } from "../models";
import { CertsColls, Users } from "../collections";
import { now } from "moment";
import { promisify } from "util";


var evnetName: any;
Meteor.methods({
    // 계좌 본인 확인
    async certifyMyUser(seq) {

        let mysqlClient = ServerUtil.getMysqlClient();
        let date = new Date();

        const REQ_DATE = ServerUtil.dateToStr(date.getFullYear(), 4) + ServerUtil.dateToStr((date.getMonth() + 1), 2) + ServerUtil.dateToStr(date.getDate(), 2);

        let query = 'select RECV_MSG from TRADE_REQUEST_TBL WHERE REQ_DATE = "' + REQ_DATE + '" and SEQ_NO = "' + seq + '";';
        try {
            mysqlClient.connect();
            let rows;
            //비동기 처리
            const sendQuery = promisify(mysqlClient.query).bind(mysqlClient);
            rows = await sendQuery(query);

            evnetName = rows[0].RECV_MSG.indexOf(Meteor.user().profile.username);

        }
        catch (e) {
            LogUtil.error({ e: 'certifyMyUSer(): ' + e.message });
            return { code: ResultCode.ERROR }
        }
        finally {
            mysqlClient.end();
        }
        return evnetName;
    },
    //계좌 본인 성명확인 요청(예금주)
    async certifyMyAddressFCS(bankCode: string, address: string) {
        let row, row2;
        if (!Meteor.user()) {
            return { code: ResultCode.ERROR };
        }
        let userAddress = Users.findOne({ 'profile.bankInfo.no': address });
        if (userAddress) {
            return { code: ResultCode.ERROR, msg: '이미 등록된 계좌가 존재합니다.' };
        }

        let mysqlClient = ServerUtil.getMysqlClient();

        let date = new Date();

        const REQ_DATE = ServerUtil.dateToStr(date.getFullYear(), 4) + ServerUtil.dateToStr((date.getMonth() + 1), 2) + ServerUtil.dateToStr(date.getDate(), 2);
        const REQ_TIME = ServerUtil.dateToStr(date.getHours(), 2) + ServerUtil.dateToStr(date.getMinutes(), 2) + ServerUtil.dateToStr(date.getSeconds(), 2);
        const SVC_TYPE = 'PAY';
        const BANK_CODE = bankCode; // 은행 코드 받아야함..
        const COMP_CODE = 'VENTAS01';
        const SEQ_NO = await ServerUtil.getNextSeq('cert' + REQ_DATE);
        //const SEQ_NO = '990003';
        const MSG_CODE = '0600400';
        const SEND_FLAG = 'N';
        const RECV_FLAG = 'N';
        const SEND_DATE = null;
        const SEND_TIME = null;
        const RECV_DATE = null;
        const RECV_TIME = null;
        const RECV_MSG = null;

        let transferReqMsg: TransferReqMsg = {
            bank_code: bankCode,
            address: address,
            //msg : cert.certNo + '벤타스비트',
            msg: '벤타스비트',
            send_date: REQ_DATE,
            send_time: REQ_TIME,
            seq_code: ServerUtil.dateToStr(SEQ_NO, 6)
            //seq_code : SEQ_NO
        }



        const SEND_MSG = getCertAddressSendMsgFCS(transferReqMsg);
        let query = 'INSERT INTO TRADE_REQUEST_TBL(REQ_DATE, REQ_TIME, SVC_TYPE, BANK_CODE, COMP_CODE, SEQ_NO, MSG_CODE, SEND_FLAG, RECV_FLAG, SEND_DATE, SEND_TIME, RECV_DATE, RECV_TIME, SEND_MSG, RECV_MSG)'
            + 'VALUES("' + REQ_DATE + '","' + REQ_TIME + '","' + SVC_TYPE + '","' + BANK_CODE + '","' + COMP_CODE + '","' + ServerUtil.dateToStr(SEQ_NO, 6) + '","' + MSG_CODE + '","' + SEND_FLAG + '","' + RECV_FLAG + '","'
            + SEND_DATE + '","' + SEND_TIME + '","' + RECV_DATE + '","' + RECV_TIME + '","' + SEND_MSG + '","' + RECV_MSG + '");';
        let query1 = 'select RECV_MSG from TRADE_REQUEST_TBL WHERE REQ_DATE = "' + REQ_DATE + '" and SEQ_NO = "' + ServerUtil.dateToStr(SEQ_NO, 6) + '";';


        try {
            mysqlClient.connect();


            //비동기 처리
            const sendQuery = promisify(mysqlClient.query).bind(mysqlClient);
            row = await sendQuery(query);
            mysqlClient.commit();
        }
        catch (e) {
            LogUtil.error({ e: 'certifyMyAddressFCS(): ' + e.message });
            return { code: ResultCode.ERROR }
        }
        finally {
            mysqlClient.end();
        }
        return { code: ResultCode.SUC, row, seq: ServerUtil.dateToStr(SEQ_NO, 6) };
    },

    //계좌 1원 송금 
    async certifyMyAddress(bankCode: string, address: string) {
        if (!Meteor.user()) {
            return { code: ResultCode.ERROR };
        }

        let userAddress = Users.findOne({ 'profile.bankInfo.no': address });
        if (userAddress) {
            return { code: ResultCode.ERROR, msg: '이미 등록된 계좌가 존재합니다.' };
        }

        let certNo = Math.floor(Math.random() * 1000);
        let cert: Cert = {
            certType: 'address',
            userId: Meteor.userId(),
            bankName: BankCode[bankCode],
            bankCode: bankCode,
            address: address,
            certNo: ServerUtil.dateToStr(certNo, 3),
            certYn: false,
            inDt: new Date()
        } as Cert

        let mysqlClient = ServerUtil.getMysqlClient();

        let date = new Date();

        const REQ_DATE = ServerUtil.dateToStr(date.getFullYear(), 4) + ServerUtil.dateToStr((date.getMonth() + 1), 2) + ServerUtil.dateToStr(date.getDate(), 2);
        const REQ_TIME = ServerUtil.dateToStr(date.getHours(), 2) + ServerUtil.dateToStr(date.getMinutes(), 2) + ServerUtil.dateToStr(date.getSeconds(), 2);
        const SVC_TYPE = 'PAY';
        const BANK_CODE = bankCode; // 은행 코드 받아야함..
        const COMP_CODE = 'VENTAS01';
        const SEQ_NO = await ServerUtil.getNextSeq('cert' + REQ_DATE);
        const MSG_CODE = '0100100';
        const SEND_FLAG = 'N';
        const RECV_FLAG = 'N';
        const SEND_DATE = null;
        const SEND_TIME = null;
        const RECV_DATE = null;
        const RECV_TIME = null;
        const RECV_MSG = null;

        let transferReqMsg: TransferReqMsg = {
            bank_code: bankCode,
            address: address,
            msg: cert.certNo + '벤타스비트',
            send_date: REQ_DATE,
            send_time: REQ_TIME,
            seq_code: ServerUtil.dateToStr(SEQ_NO, 6)
        }

        const SEND_MSG = getCertAddressSendMsg(transferReqMsg);

        let query = 'INSERT INTO TRADE_REQUEST_TBL(REQ_DATE, REQ_TIME, SVC_TYPE, BANK_CODE, COMP_CODE, SEQ_NO, MSG_CODE, SEND_FLAG, RECV_FLAG, SEND_DATE, SEND_TIME, RECV_DATE, RECV_TIME, SEND_MSG, RECV_MSG)'
            + 'VALUES("' + REQ_DATE + '","' + REQ_TIME + '","' + SVC_TYPE + '","' + BANK_CODE + '","' + COMP_CODE + '","' + ServerUtil.dateToStr(SEQ_NO, 6) + '","' + MSG_CODE + '","' + SEND_FLAG + '","' + RECV_FLAG + '","'
            + SEND_DATE + '","' + SEND_TIME + '","' + RECV_DATE + '","' + RECV_TIME + '","' + SEND_MSG + '","' + RECV_MSG + '");';
        try {
            mysqlClient.connect();

            mysqlClient.query(query, (err, results, fields) => {
                console.log(err)
                console.log(results)
            });
        }
        catch (e) {
            LogUtil.error({ e: 'certifyMyAddress(): ' + e.message });
            return { code: ResultCode.ERROR }
        }
        finally {
            mysqlClient.end();
        }
        CertsColls.insert(cert);
        return { code: ResultCode.SUC, cert }
    },
    async checkAddress(certNo: string) {
        if (!certNo || !Meteor.userId()) {
            return { code: ResultCode.ERROR };
        }

        let cert = CertsColls.findOne({ certType: 'address', userId: Meteor.userId(), certYn: false }, { sort: { inDt: -1 } });

        if (!cert) {
            return { code: ResultCode.ERROR };
        }

        if (cert.certNo != certNo) {
            return { code: ResultCode.ERROR };
        }

        let result = await CertsColls.update({ _id: cert._id }, { $set: { certYn: true } }).first().toPromise();
        if (!result) {
            return { code: ResultCode.ERROR };
        }

        let user = Meteor.user();
        user.profile['bankYn'] = 'Y';
        let bankInfo = {
            no: cert.address,
            name: cert.bankName,
            code: cert.bankCode,
            ownerName: user.profile.username + await ServerUtil.getNextSeq(user.profile.username)
        }
        user.profile['bankInfo'] = bankInfo;
        user.profile['lvl'] = 'C';

        result = await Users.update({ _id: Meteor.userId() }, { $set: { profile: user.profile } }).first().toPromise();
        if (!result) {
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC }
    },
    getTodayMyAddressCert() {
        if (!Meteor.userId()) {
            return { code: ResultCode.ERROR };
        }

        return CertsColls.find({ certType: 'address', certYn: false, userId: Meteor.userId() }, { sort: { inDt: -1 }, readPreference: ReadPref.SECONDARY_PREFERRED });
    }
});


function getCTypeMsg(value: string, space: number) {
    let valueLength = value.length;

    if (valueLength < space) {
        for (let i = 0; i < (space - valueLength); i++) {
            value += ' ';
        }
    }

    return value;
}

function getCertAddressSendMsg(transferReqMsg: TransferReqMsg) {
    let send_msg = '';

    // 공통부 1 : 식별코드
    if (BankIdentificationCode[transferReqMsg.bank_code]) {
        send_msg += getCTypeMsg(BankIdentificationCode[transferReqMsg.bank_code], 9);
    } else {
        send_msg += '         ';
    }

    // 공통부 2 : 업체코드 
    send_msg += 'VENTAS01';

    // 공통부 3 : 은행코드2
    send_msg += '  ';

    // 공통부 4 : 메시지 코드
    send_msg += '0100';

    // 공통부 5 : 업무 구분 코드
    send_msg += '100';

    // 공통부 6 : 송신 횟수
    send_msg += '1';

    // 공통부 7 : 전문 번호
    send_msg += transferReqMsg.seq_code;

    // 공통부 8 : 전송 일자
    send_msg += transferReqMsg.send_date;

    // 공통부 9 : 전송 시간
    send_msg += transferReqMsg.send_time;

    // 공통부 10 : 응답 코드
    send_msg += '    ';

    // 공통부 11 : 은행 응답 코드
    send_msg += '    ';

    // 공통부 12 : 조회일자
    send_msg += '        ';

    // 공통부 13 : 조회번호
    send_msg += '      ';

    // 공통부 14 : 은행 전문 번호
    send_msg += '               ';

    // 공통부 15 : 은행코드3
    send_msg += '039';

    // 공통부 16 : 예비
    send_msg += '             ';

    // 송금부 1 : 출금 계좌번호
    send_msg += '8003344215239  '

    // 송금부 2 : 통장 비밀 번호
    send_msg += '        ';

    // 송금부 3 : 복기 부호
    send_msg += '      ';

    // 송금부 4 : 출금 금액
    send_msg += '0000000000001';

    // 송금부 5 : 출금 후 잔액부호
    send_msg += ' ';

    // 송금부 6 : 출금 후 잔액
    send_msg += '             ';

    // 송금부 7 : 입금 은행 코드
    send_msg += '  ';

    // 송금부 8 : 입금 계좌 번호
    send_msg += getCTypeMsg(transferReqMsg.address, 15);

    // 송금부 9 : 수수료
    send_msg += '         ';

    // 송금부 10 : 이체시각
    send_msg += transferReqMsg.send_time;

    // 송금부 11 : 입금 계좌 적요
    send_msg += getCTypeMsg(transferReqMsg.msg, 15);

    // 송금부 12 : CMS 코드
    send_msg += '                ';

    // 송금부 13 : 신원확인번호
    send_msg += '             ';

    // 송금부 14 : 자동이체 구분
    send_msg += '  ';

    // 송금부 15 : 출금 계좌 적요
    send_msg += '                    ';

    // 송금부 16 : 입금 은행 코드3
    send_msg += transferReqMsg.bank_code;

    // 송금부 17 : 급여 구분
    send_msg += ' ';

    // 송금부 18 : 예비
    send_msg += '                                     ';

    return send_msg;
}


function getCertAddressSendMsgFCS(transferReqMsg) {
    let send_msg = '';

    // 공통부 1 : 식별코드
    if (BankIdentificationCode[transferReqMsg.bank_code]) {
        send_msg += getCTypeMsg(BankIdentificationCode[transferReqMsg.bank_code], 9);
    } else {
        send_msg += '         ';
    }

    // 공통부 2 : 업체코드 
    send_msg += 'VENTAS01';

    // 공통부 3 : 은행코드2
    send_msg += '  ';

    // 공통부 4 : 메시지 코드
    send_msg += '0600';

    // 공통부 5 : 업무 구분 코드
    send_msg += '400';

    // 공통부 6 : 송신 횟수
    send_msg += '1';

    // 공통부 7 : 전문 번호
    send_msg += transferReqMsg.seq_code;

    // 공통부 8 : 전송 일자
    send_msg += transferReqMsg.send_date;

    // 공통부 9 : 전송 시간
    send_msg += transferReqMsg.send_time;

    // 공통부 10 : 응답 코드
    send_msg += '    ';

    // 공통부 11 : 은행 응답 코드
    send_msg += '    ';

    // 공통부 12 : 조회일자
    send_msg += '        ';

    // 공통부 13 : 조회번호
    send_msg += '      ';

    // 공통부 14 : 은행 전문 번호
    send_msg += '               ';

    // 공통부 15 : 은행코드3
    send_msg += '099';

    // 공통부 16 : 예비
    send_msg += '             ';

    // 개별부 1 : 거래일자 MMDD 4
    send_msg += transferReqMsg.send_date.toString().substr(4, 6);

    // 개별부 2 : 은행코드2 2
    send_msg += '  ';

    // 개별부 3 : 계좌번호 16
    send_msg += getCTypeMsg(transferReqMsg.address, 16);

    // 개별부 4 : 예금주명 22
    send_msg += '                      ';

    // 개별부 5 : 신원확인번호 13
    send_msg += '             ';

    // 개별부 6 : 신원확인번호 체크 2
    send_msg += '  ';

    // 개별부 7 : 업체 계좌번호 20
    send_msg += '                    ';

    // 개별부 8 : 은행코드3 3
    send_msg += transferReqMsg.bank_code;

    // 개별부 9 : 금액 13
    send_msg += '             ';

    // 개별부 10 : 닷컴통장 조회 1
    send_msg += ' ';

    // 개별부 11 : 당타행인증유형 1
    send_msg += ' ';

    // 개별부 12 : 농협계좌 구분 1
    send_msg += ' ';

    // 개별부 13 : 예비 102
    send_msg += '                                                                                                      ';

    return send_msg;
}