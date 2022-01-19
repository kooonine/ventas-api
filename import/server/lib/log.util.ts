import { ServerUtil } from "./server.util";

const winston = require('winston');
const fs = require('fs');
const logDirName = '../../../log';

if (!fs.existsSync(logDirName)) {
    fs.mkdirSync(logDirName);
}

class _LogUtil {
    errorLogger: any;
    infoLogger: any;
    errorLoggerInitDt: string;
    infoLoggerInitDt: string;
    isProd: boolean = true;
    moment: any

    constructor() {
        this.moment = ServerUtil.getMomentInstance();
        this.initErrorLogger();
        this.initInfoLogger();
    }

    initErrorLogger() {
        this.errorLogger = winston.createLogger({
            transports: [
                new winston.transports.File({
                    level: 'silly',
                    filename: logDirName + '/' + this.moment().format('YYMMDD') + '-error.log'
                })
            ]
        });
        this.errorLoggerInitDt = new Date().toLocaleDateString();
    }

    initInfoLogger() {
        this.infoLogger = winston.createLogger({
            transports: [
                new winston.transports.File({
                    level: 'silly',
                    filename: logDirName + '/' + this.moment().format('YYMMDD') + '-info.log'
                })
            ]
        });
        this.infoLoggerInitDt = new Date().toLocaleDateString();
    }

    error(error: {}, isConsole: boolean = false) {
        if (!error) {
            return;
        }        

        if (Meteor.isServer) {
            error['id'] = Meteor.userId();
        }

        error['ts'] = this.moment().format('YY-MM-DD HH:mm:ss');

        if (!this.isProd) {
            console.log(error, new Date())
        }

        if (isConsole) {
            return;
        }

        if (new Date().toLocaleDateString() != this.errorLoggerInitDt || !this.errorLogger) {
            this.initErrorLogger();
        }        

        try {            
            this.errorLogger.error(error);
            this.infoLogger.info(error);
        } catch (err) {
            console.log(err)
        }

    }

    info(info: {}, isConsole: boolean = false) {
        if (!info) {
            return;
        }

        if (Meteor.isServer) {
            info['id'] = Meteor.userId();
        }
        info['ts'] = this.moment().format('YY-MM-DD HH:mm:ss');

        if (!this.isProd) {
            console.log(info)
        }

        if (isConsole) {
            return;
        }

        if (new Date().toLocaleDateString() != this.infoLoggerInitDt || !this.infoLogger) {
            this.initInfoLogger();
        }        

        try {            
            this.infoLogger.info(info);
        } catch (err) {
            console.log(err)
        }
    }

}

export const LogUtil = new _LogUtil();