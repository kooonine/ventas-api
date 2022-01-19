import { ServerUtil, LogUtil } from "../lib";
import { promisify } from "util";
import { FiatRateCollection } from "../collections";
import { FiatRate, ReadPref } from "../models";

export class _RedisService {
    flushdb() {
        let redisCli = ServerUtil.getRedisClient();
        let flushdbAsync = promisify(redisCli.flushdb).bind(redisCli);

        return flushdbAsync();
    }
    setFiatRate(fiatRate: FiatRate) {
        let redisCli = ServerUtil.getRedisClient();
        redisCli.zadd('fiatRate_' + fiatRate.src + '_' + fiatRate.target, fiatRate.ts, JSON.stringify(fiatRate));
        let datas;

        if(fiatRate.closePrice == fiatRate.presentPrice){

        } else {
            datas = {
                time: fiatRate.ts,
                open: fiatRate.closePrice,
                high: fiatRate.presentPrice,
                low: fiatRate.presentPrice,
                close: fiatRate.presentPrice,
                volume: fiatRate.amount * fiatRate.presentPrice
            } ;
            redisCli.zadd('trading_' + fiatRate.src + '_' + fiatRate.target, fiatRate.ts, JSON.stringify(datas));
        }
    }
    async setAllFiatRates() {
        try{
            let redisCli = ServerUtil.getRedisClient();
            let zaddAsync = promisify(redisCli.zadd).bind(redisCli);

            if (!redisCli) {
                LogUtil.error({ e: 'setAllFiatRates(): redisClient is null.' });
                return;
            }

            let fiatRateCursor = await FiatRateCollection.rawCollection().find({}, { readPreference: ReadPref.SECONDARY_PREFERRED });
            let fiatRateListCnt = await fiatRateCursor.count();
            let fiatRateList = await fiatRateCursor.toArray();

            let outerRoopIdx = Math.ceil(fiatRateListCnt / 80000);
            let innerRoopIdx = 80000;

            console.log('setAllFiatRates-1', new Date);        
            
            // redis zadd의 경우 입력 파라미터의 갯수가 1024 x 1024이므로 10만개씩 쪼개서 넣는다.
            let values;
            let keys;
            for (let i = 0; i < outerRoopIdx; i++) {
                if (i == (outerRoopIdx - 1)) {
                    innerRoopIdx = fiatRateListCnt % 80000;
                }

                // fiatRate의 src, target 분류에 따라 {key : [ts, fiatrate...]} 형태로 만든다.
                values = {};                
                for (let j = (i * 80000); j < (innerRoopIdx + (i * 80000)); j++) {
                    let key = 'fiatRate_' + fiatRateList[j].src + '_' + fiatRateList[j].target;
                    if (!values[key]) { values[key] = [] }
                    values[key].push(fiatRateList[j].ts);
                    values[key].push(JSON.stringify(fiatRateList[j]));
                }
                // key값에 맞게 fiatRate를 redis에 집어넣는다.
                keys = Object.keys(values);                
                for (let k = 0; k < keys.length; k++) {
                    await zaddAsync(keys[k], values[keys[k]]);
                }
            }
        }catch(err){
            LogUtil.error({ e: "setAllFiatRates(): " + err.message });
        }
        console.log('setAllFiatRates-2', new Date);
    }
    getFiatRate(src: string, target: string) {
        let redisCli = ServerUtil.getRedisClient();
        let getAsync = promisify(redisCli.zrange).bind(redisCli);

        if (!redisCli) {
            LogUtil.error({ e: 'getFiatRate():redisClient is null.' });
            return [];
        }

        return getAsync('fiatRate_' + src + '_' + target, -1, -1);
    }
    getFiatRateListByLimit(src: string, target: string, limit: number) {
        LogUtil.info({ console : 'getFiatRateListByLimit()' }, true);

        if(!src || !target || !limit){
            LogUtil.error({ e : 'getFiatRateListByLimit() : invalid param.. src / target / limit : ' + src + ' / ' + target + ' / ' + limit });
            return [];
        }

        let redisCli = ServerUtil.getRedisClient();
        let getAsync = promisify(redisCli.zrange).bind(redisCli);

        if (!redisCli) {
            LogUtil.error({ e: 'getFiatRate():redisClient is null.' });
            return [];
        }

        return getAsync('fiatRate_' + src + '_' + target, -limit, -1);
    }
    getFiatrateByTs(src: string, target: string, fromTs: number, toTs: number) {
        LogUtil.info({ console: 'getFiatrateByTs' }, true);
        let redisCli = ServerUtil.getRedisClient();
        let getAsync = promisify(redisCli.zrangebyscore).bind(redisCli);

        fromTs = Number(fromTs * 1000);
        toTs = Number(toTs * 1000);

        return getAsync('fiatRate_' + src + '_' + target, fromTs, toTs);
    }
    async getFiatrateByTs2(src: string, target: string, fromTs: number, toTs: number) {
        
        let redisCli = ServerUtil.getRedisClient();
        let getAsync = promisify(redisCli.zrangebyscore).bind(redisCli);

        fromTs = Number(fromTs * 1000);
        toTs = Number(toTs * 1000);

        let result;
        result = await getAsync('fiatRate_' + src + '_' + target, fromTs, toTs);

        let datas = [];
        for(let i=0; i<result.length; i++){
            result[i] = JSON.parse(result[i]);	
            if(result[i].closePrice == result[i].presentPrice){

            } else {
                if(result[i].src == src && result[i].target == target){
                    datas.push({
                        time: result[i].ts,
                        open: result[i].closePrice,
                        high: result[i].presentPrice,
                        low: result[i].presentPrice,
                        close: result[i].presentPrice,
                        volume: result[i].amount * result[i].presentPrice
                    });
                }
            }
        }

        return datas

    }
}
export const RedisService = new _RedisService();