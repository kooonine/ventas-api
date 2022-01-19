import { LogUtil } from "../lib";
import { NoticeCollection } from "../collections/notice.collection";
import { ReadPref } from "../models";
import { CN_NoticeCollection } from "../collections";

export class _NoticeService {
    async getNoticeList(noticeNo?: number){
        let result = [];

        try {
            if(noticeNo){
                result = await NoticeCollection.find({ useYn : 'Y', no : noticeNo } , { readPreference : ReadPref.SECONDARY_PREFERRED });
            } else {
                result = await NoticeCollection.find({ useYn : 'Y' } , { sort : { no : -1 } , readPreference : ReadPref.SECONDARY_PREFERRED });
            }
        } catch (err) {
            LogUtil.error({e : 'getNoticeList() : exception. ' + err.message});
            return [];
        }

        return result;
    }

    async getCnNoticeList(noticeNo? : number){
        let result = [];

        try {
            if(noticeNo){
                result = await CN_NoticeCollection.find({ useYn : 'Y', no : noticeNo } , { readPreference : ReadPref.SECONDARY_PREFERRED });
            } else {
                result = await CN_NoticeCollection.find({ useYn : 'Y' } , { sort : { no : -1 } , readPreference : ReadPref.SECONDARY_PREFERRED });
            }
        } catch (err) {
            LogUtil.error({e : 'getCnNoticeList() : exception. ' + err.message});
            return [];
        }

        return result;
    }
}

export const NoticeService = new _NoticeService();