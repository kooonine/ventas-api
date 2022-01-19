import { Meteor } from 'meteor/meteor';
import { RedisService } from './service';
import { DecimalUtil } from "../../import/server/lib";

Meteor.startup(() => {
    console.log('★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★');
    let test = DecimalUtil.add('200.00000000000000', '-200.0000000020000000040000000001000100', true)
    console.log(test);
    
});
