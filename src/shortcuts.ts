import * as Linking from 'expo-linking';

export type NouraDeepLinkAction='tell'|'meal'|'symptoms'|'bowel'|'cycle';
export function buildNouraLink(action:NouraDeepLinkAction){return `noura://${action}`;}
export function parseNouraLink(url:string):NouraDeepLinkAction|undefined{
  try{const parsed=Linking.parse(url);const host=(parsed.hostname||parsed.path||'').replace(/^\//,'');return ['tell','meal','symptoms','bowel','cycle'].includes(host)?host as NouraDeepLinkAction:undefined;}catch{return undefined;}
}
export const SHORTCUT_EXAMPLES=[
  {title:'Noura erzählen',url:'noura://tell'},
  {title:'Mahlzeit eintragen',url:'noura://meal'},
  {title:'Körpergefühl eintragen',url:'noura://symptoms'},
  {title:'Stuhlgang eintragen',url:'noura://bowel'},
  {title:'Zyklus eintragen',url:'noura://cycle'},
];
