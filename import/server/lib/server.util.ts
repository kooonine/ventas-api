import { LockType, ResultCode } from "../models";
import { Meteor } from 'meteor/meteor';
import * as redis from 'redis';
import * as RedLock from 'redlock';
import * as _ from 'lodash';
import { HelperCollection, SeqCollection } from "../collections";
import fetch from 'node-fetch';
import { LogUtil } from "./log.util";
import * as admin from 'firebase-admin'; // 파이어베이스 (푸시알림)

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const GRS_EXEC = Meteor.settings.private.nice.exec;
const code = Meteor.settings.private.nice.code;
const pwd = Meteor.settings.private.nice.sec;
const mysql = require('mysql');
const moment = require('moment')
const serviceAccount = require('../../../fcm_key/firebase-adminsdk.json'); // 인증키

/** 
 * 공통 유틸.
 */
class _ServerUtil {
    redis: any = [];
    mysqlCfg: any;
    redLock: any;
    coinCoreClientList: any = [];
    readonly NUMBERS = '0123456789';

    constructor() {
        console.log("ServerUtil create...");
        this.initRedisClient();
        this.initMysqlClient();
        this.firebaseInitialize();
    }
    private initRedisClient() {
        let cfg = Meteor.settings.private.redis;
        _.each(cfg, (data, key) => {
            console.log('redis', data, key);
            let cli = redis.createClient(data.port, data.host);
            this.redis.push(cli);
        })
        this.redLock = new RedLock(this.redis, {
            retryCount: 20
        });

        this.redLock.on('clientError', (error) => {
            console.log('redLock Error', error);
        });
    }
    private initMysqlClient() {
        this.mysqlCfg = Meteor.settings.private.mysql;
        console.log('mysql', this.mysqlCfg.server1);
    }

    /**
     * lock 을 가지고 온다.
     * @param value 
     * @param ttl 
     */
    getLock(lockType: LockType, value: string, ttl: number = 2000): Promise<any> {
        // this.redLock
        return this.redLock.lock(lockType + ':' + value, ttl);
    }
    async getNiceId(reqNo?: string, reqType: string = 'new', sucUrl?: string, failUrl?: string) {
        const seq = "";
        const authType = "M";

        let returnUrl;
        if (reqType == 'reg') {
            returnUrl = Meteor.settings.private.nice.sucRegUrl;
        } else if (reqType == 'findId') {
            returnUrl = Meteor.settings.private.nice.sucFindIdUrl;
        }
        else {
            returnUrl = Meteor.settings.private.nice.sucUrl;
        }
        let errUrl = Meteor.settings.private.nice.failUrl;
        if (sucUrl) {
            returnUrl = sucUrl;
        }
        if (failUrl)
            errUrl = failUrl;
        const popgubun = "N";
        const customize = "Mobile";
        const gender = "";

        let req = "";
        //+ "7:REQ_SEQ" . strlen($reqseq) . ":" . $reqseq . 
        if (reqNo)
            req = "7:REQ_SEQ" + reqNo.length + ":" + reqNo;
        let plain = req + "8:SITECODE" + code.length + ":" + code +
            "9:AUTH_TYPE" + authType.length + ":" + authType +
            "7:RTN_URL" + returnUrl.length + ":" + returnUrl +
            "7:ERR_URL" + errUrl.length + ":" + errUrl +
            "11:POPUP_GUBUN" + popgubun.length + ":" + popgubun +
            "9:CUSTOMIZE" + customize.length + ":" + customize +
            "6:GENDER" + gender.length + ":" + gender;

        let enc = await exec(GRS_EXEC + " enc " + " " + code + " " + pwd + " " + plain);

        return enc.stdout;
    }
    async getNextSeq(collection: string | HelperCollection<any>): Promise<any> {

        let colName;
        if (typeof collection === "string") {
            colName = collection as string;
        } else {
            /** client 에서 설정되지 않는다. */
            const col = collection as HelperCollection<any>;
            colName = col.collectionName;
        }
        const selector = { _id: colName };
        const modify = {
            $inc: { value: 1 }
        }

        const lock = await this.getLock(LockType.seq, colName);
        try {
            const rt = await SeqCollection.collection.rawCollection().findAndModify(selector, [], modify, { 'new': true, 'upsert': true });
            return rt.value.value;
        } catch (exception) {
            throw exception;
        } finally {
            lock.unlock();
        }
    }

    async decodeNice(data?: string) {
        let decode = await exec(GRS_EXEC + " dec " + " " + code + " " + pwd + " " + data);
        let re = JSON.parse(decode.stdout);
        return re;
    }

    getRedisClient() {
        return this.redis[0];
    }

    getMysqlClient() {
        let mysqlClient = mysql.createConnection({
            host: this.mysqlCfg.server1.host,
            user: this.mysqlCfg.server1.user,
            password: this.mysqlCfg.server1.password,
            database: this.mysqlCfg.server1.database
        });
        return mysqlClient ? mysqlClient : undefined;
    }
    async getIpCounty(ip: string) {
        let result;
        let r;
        try {
            result = await fetch("http://ip-api.com/json/" + ip);
            let txt = await result.json();            
            r = { ip: ip, country: txt.countryCode, name: txt.country + ' ' + txt.regionName };
        } catch (err) {
            LogUtil.error({ e: 'getIpCountry(): ' + err.message })
            return undefined;
        }

        return r;
    }

    public getMomentInstance() {
        return moment;
    }

    public getKoTimeString() {
        let koTimeString;
        try {
            koTimeString = moment().format('YYYYMMDDHHmmssSSS');

            if (!koTimeString) {
                return '11111111111111111';
            }

        } catch (err) {
            LogUtil.error({ e: "getKoTimeString(): " + err.message });
            return '11111111111111111';

        }

        return koTimeString;
    }

    public randomNum(len: number) {
        let result = '';
        for (let i = 0; i < len; i++) {
            var rnum = Math.floor(Math.random() * this.NUMBERS.length);
            var randomnumber = parseInt(this.NUMBERS.substring(rnum, rnum + 1));
            result += randomnumber;
        }
        return result;
    }

    public getLocaleDate(date: Date = new Date()) {
        let dateStr = this.dateToStr(date.getFullYear(), 4)
            + this.dateToStr(date.getMonth() + 1, 2)
            + this.dateToStr(date.getDate(), 2)
            + this.dateToStr(date.getHours(), 2)
            + this.dateToStr(date.getMinutes(), 2)
            + this.dateToStr(date.getSeconds(), 2)
            + this.dateToStr(date.getMilliseconds(), 3);

        return dateStr;
    }

    public dateToStr(date: number, digit: number) {
        let dateStr = String(date);
        let dateLength = dateStr.length;

        if (dateLength < digit) {
            for (let i = 0; i < (digit - dateLength); i++) {
                dateStr = '0' + dateStr;
            }
        }
        return dateStr;
    }

    public async firebaseInitialize(){
        // admin 앱 가동
        console.log('create firebase');
        try {
            await admin.initializeApp({
                credential : admin.credential.cert(serviceAccount)
            });
        } catch (err) {
            console.log('firebase initialize err : ',err.message);
            return;
        }

        console.log('firebase initialize Success');
    }

    /**
     * 
     * @param messageType : 전송할 메시지 타입 (push_message.ts 에서 만들어 보내줌)
     * @param fcmToken : 전송할 사용자 토큰값
     */
    public async pushMessage(messageObject : any){
        let result;
        
        // console.log('message : ',messageObject);
        
        await admin.messaging().send(messageObject).then((res)=>{
            // console.log('firebase messageing suc : ',res);
            result = ResultCode.SUC;
        }).catch((err)=>{
            // console.log('firebase messageing err : ',err);
            result = ResultCode.ERROR;
        });

        return result;
    }

}
export const ServerUtil = new _ServerUtil();
