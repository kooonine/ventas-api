import { Meteor } from 'meteor/meteor';
import { HelperCollection } from './helper.collection';



export const Users = HelperCollection.fromExisting(Meteor.users, 'users');

Users['publicFields'] = {
    emails: 1,
    'profile': 1,
    roles:1,
    inDt: 1,
    upDt: 1,
    inUser: 1,
    upUser: 1,
    services : 1,
};
