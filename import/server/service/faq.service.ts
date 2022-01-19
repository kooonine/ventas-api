import { FaqCollection, CN_FaqCollection } from "../collections";
import { ReadPref } from "../models";
import { LogUtil } from "../lib";

export class _FaqService {
    public async getFaqList(){
        let faqList = [];
        try{
            faqList = await FaqCollection.find({}, { readPreference: ReadPref.SECONDARY_PREFERRED });
        }catch(err){
            LogUtil.error({ e: 'getFaqList(): ' + err.message });
            return [];
        }

        return faqList;
    } 

    public async getCnFaqList(){
        let faqList = [];
        try{
            faqList = await CN_FaqCollection.find({}, { readPreference: ReadPref.SECONDARY_PREFERRED });
        }catch(err){
            LogUtil.error({ e: 'getCnFaqList(): ' + err.message });
            return [];
        }

        return faqList;
    }
}
export const FaqService = new _FaqService();