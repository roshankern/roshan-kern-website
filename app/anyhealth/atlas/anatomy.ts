export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac';
/** `color` marks a system in the UI (legend, issue dots, timeline): seaborn-style "hls", 15 evenly spaced hues from h=0.01 at lightness .6, saturation .65, each given to the system it suits. `mesh` is the anatomical colour the 3D model is drawn in. */
export const SYSTEMS: {id:SystemId;name:string;color:string;mesh:string}[] = [
 {id:'skeletal',name:'Skeleton',color:'#dbc957',mesh:'#e2d9ba'},
 {id:'muscular',name:'Muscles',color:'#db9457',mesh:'#a85b50'},
 {id:'cardiac',name:'Heart',color:'#db5f57',mesh:'#b96760'},
 {id:'sensory',name:'Sensory organs',color:'#5f57db',mesh:'#b0c8ce'},
 {id:'arterial',name:'Arteries',color:'#db5784',mesh:'#c05245'},
 {id:'venous',name:'Veins',color:'#5784db',mesh:'#527c9f'},
 {id:'nervous',name:'Nervous system',color:'#b9db57',mesh:'#d8b565'},
 {id:'respiratory',name:'Respiratory',color:'#57b9db',mesh:'#b98991'},
 {id:'digestive',name:'Digestive',color:'#c957db',mesh:'#b8916b'},
 {id:'urinary',name:'Urinary',color:'#57dbc9',mesh:'#b47961'},
 {id:'lymphatic',name:'Lymphatic',color:'#57db5f',mesh:'#879f7c'},
 {id:'endocrine',name:'Endocrine',color:'#84db57',mesh:'#c5a09a'},
 {id:'reproductive',name:'Reproductive',color:'#9457db',mesh:'#bda098'},
 {id:'integumentary',name:'Body surface',color:'#db57b9',mesh:'#ba9b7d'},
 {id:'connective',name:'Connective tissue',color:'#57db94',mesh:'#aec3bb'},
];
export interface Part {id:string;name:string;conceptId:string;system:SystemId;chunk:number;vertices:number;vertexBytes:number;indices:number;indexBytes:number;vertexCount:number;indexCount:number;bounds:[number[],number[]]}
export interface Concept {id:string;name:string;elements:string[]}
export interface Atlas {version:string;sex?:'male';source?:string;scope?:string;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number}[];triangles:number}
export interface SceneState {visible:SystemId[]}
export const DEFAULT_VISIBLE:SystemId[] = ['cardiac','sensory','skeletal','muscular','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','integumentary','connective'];
