import { Question } from "../models";
import { HelperCollection } from "./helper.collection";

export const QuestionCollection = new HelperCollection<Question>('question');