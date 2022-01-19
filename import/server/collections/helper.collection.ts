import { MongoObservable, ObservableCursor } from 'meteor-rxjs';
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { ObjRight } from '../models';


/**
 * TODO 
 * 보안 추가 해야 한다.
 * 일반 사용자가 볼때, 관리자가 볼때, 로그인 이전 사용자가 볼때 등으로 구분을 지어야 한다.
 * 
 */
export class HelperCollection<T> extends MongoObservable.Collection<T>{
    //for client...
    helper: any;
    objName: string;
    pubname: string;
    signlePubname: string;
    counterName: string;
    publicFields: any;
    right: ObjRight;
    rawInstance: any;

    static fromExisting<T>(collection: Mongo.Collection<T>, collectionName: string, right?: ObjRight): HelperCollection<T> {
        return new HelperCollection(collection, collectionName, right);
    }

    constructor(public nameOrExisting: string | Mongo.Collection<T>,
        public collectionName?: string,
        right?: ObjRight,
        options?: MongoObservable.ConstructorOptions) {

        super(nameOrExisting, options);

        this.rawInstance = this.rawCollection();

        this.right = right ? right : ObjRight.USER;

        if (typeof nameOrExisting === "string") {
            this.pubname = nameOrExisting as string;
        } else {
            /** client 에서 설정되지 않는다. */
            this.pubname = collectionName;
        }

        this.signlePubname = this.pubname + "_obj";
        this.counterName = this.pubname + "_count";

        if (Meteor.isServer) {
            this.collection['before'].insert((userId, doc) => {
                doc['inUser'] = userId;
                doc['inDt'] = new Date();
            });

            this.collection['before'].update((userId, doc, fieldNames, modifier, options) => {
                modifier['$set'] = modifier['$set'] || {};
                modifier['$set']['upUser'] = userId;
                modifier['$set']['upDt'] = new Date();                
            });
        }
    }

    find(selector?: Mongo.Selector | Mongo.ObjectID | string, options?: {
        sort?: Mongo.SortSpecifier;
        skip?: number;
        limit?: number;
        fields?: Mongo.FieldSpecifier;        
        readPreference?: string
    }){
        if(!selector){
            selector = {};
        }

        return this.rawInstance.find(selector, options).toArray();
    }
    
    findOneSecondary(selector?: Mongo.Selector | Mongo.ObjectID | string, options?: {
        sort?: Mongo.SortSpecifier;
        skip?: number;
        limit?: number;
        fields?: Mongo.FieldSpecifier;        
        readPreference?: string
    }){ 
        return this.rawInstance.findOne(selector, options);
    }

    findForPublish(selector?: Mongo.Selector | Mongo.ObjectID | string, options?: {
        sort?: Mongo.SortSpecifier;
        skip?: number;
        limit?: number;
        fields?: Mongo.FieldSpecifier;
    }){
        if(!selector){
            selector = {};
        }

        return super.find(selector, options);        
    }

}


