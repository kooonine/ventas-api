import { Meteor } from 'meteor/meteor';
import { HelperCollection, Users } from "../collections";
import { ObjRight, Options } from '../models';


/**
 * 공통 유틸.
 */
class _HelperUtil {
    /**
     * 기본인 퍼블리쉬를 한다.
     * 저장소명, 개별조회,카운트을 퍼블리쉬 한다.
     * @param collection 
     */
    publish(collection: HelperCollection<any>) {
        if (collection.collectionName === 'users') {
            collection = Users;
        }

        Meteor.publish(collection.pubname, function (query: any) {
            const selector = query ? query : {};            
            return collection.findForPublish(selector);
        });

        Meteor.publish(collection.signlePubname, function (_id: string) {            
            return collection.findForPublish({ _id: _id });
        });
    }
}
export const HelperUtil = new _HelperUtil();
