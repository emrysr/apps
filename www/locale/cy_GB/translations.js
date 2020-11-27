import mysolarpv from './mysolarpv.js';
import myelectric from './myelectric.js';
import mysolarpvdivert from './mysolarpvdivert.js';
import myheatpump from './myheatpump.js';
// import [another plain object] from '[another js file]'


const generic = {
    'English text as key': 'Testyn Cymraeg fel gwerth',
    'Red Box': 'Bocs Coch'
}


// use the spread syntax to merge imported language packs
const language_packs = {
    ...generic, 
    ...mysolarpv, 
    ...myelectric,
    ...mysolarpvdivert,
    ...myheatpump
}

// export single language file
export default language_packs;