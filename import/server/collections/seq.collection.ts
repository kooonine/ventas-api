
import { Sequence } from '../models';
import { MongoObservable } from 'meteor-rxjs';

export const SeqCollection = new MongoObservable.Collection<Sequence>("_sequence");