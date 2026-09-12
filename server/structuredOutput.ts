// Stage 1.5 transport schema: unchanged product fields, no additional semantics.
const strings = (keys: string[]) => Object.fromEntries(keys.map(key => [key, {type:'string'}]));
const object = (properties: Record<string, unknown>) => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const MYTH_SCHEMA = object({
  mode:{type:'string',enum:['story']},status:{type:'string',enum:['ok']},writer_version:{type:'string'},
  story_result:object({
    ...strings(['title','story']),
    mirror:object(strings(['mainImage','innerTension','hiddenResource','newView'])),
    meaning:{type:'array',items:{type:'string'}},...strings(['one_step','journal_question','disclaimer']),
  }),
});
export const MEETING_SCHEMA = object({status:{type:'string',enum:['ok']},result:object({
  ...strings(['summary','confidenceNote']),hasStrongParallels:{type:'boolean'},
  parallels:{type:'array',items:object(strings(['theme','codeAnchor','mythAnchor','synthesis']))},
  divergences:{type:'array',items:object(strings(['theme','codeAspect','mythAspect','reflection']))},
  ...strings(['albertInsight','reflectiveQuestion','disclaimer']),
})});
export const strictFormat = (name:string,schema:Record<string,unknown>) => ({
  type:'json_schema' as const,json_schema:{name,strict:true as const,schema},
});
