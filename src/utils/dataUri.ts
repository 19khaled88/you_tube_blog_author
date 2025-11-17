import DataURIParser from "datauri/parser.js";
import path from "path";


const getBuffer = (file:any)=>{
    const parser = new DataURIParser();
    const ext = path.extname(file.originalname).toString();
    const dataUri = parser.format(ext, file.buffer);
    return dataUri;
}

export default getBuffer;