"use client";
import {useEffect,useState} from 'react';
export default function ExportReceipt(){const [file,setFile]=useState(null);useEffect(()=>{const handler=e=>setFile(e.detail);window.addEventListener('bundle-export',handler);return()=>window.removeEventListener('bundle-export',handler);},[]);return file?<aside className="export-receipt wrap" role="status">文件已生成；是否已保存请看浏览器下载记录。<a href={file.url} download={file.name}>保存 {file.name}</a><small>此文件是生成时的输入与结果快照。</small></aside>:null;}
