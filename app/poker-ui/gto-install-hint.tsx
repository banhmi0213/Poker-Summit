'use client';
import {useEffect,useState} from 'react';
import styles from './gto-install-hint.module.css';
const DISMISSED='poker-summit-gto-install-dismissed';
export function GtoInstallHint(){
 const [visible,setVisible]=useState(false),[ios,setIos]=useState(false);
 useEffect(()=>{
  const standalone=window.matchMedia('(display-mode: standalone)');
  const update=()=>{try{setVisible(!standalone.matches&&!(navigator as Navigator&{standalone?:boolean}).standalone&&localStorage.getItem(DISMISSED)!=='1');}catch{setVisible(false);}};
  setIos(/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));update();
  standalone.addEventListener('change',update);window.addEventListener('storage',update);
  return()=>{standalone.removeEventListener('change',update);window.removeEventListener('storage',update);};
 },[]);
 if(!visible)return null;
 return <aside className={styles.hint} aria-label="ホーム画面への追加方法"><div><strong>ホーム画面からアプリのように開く</strong><p>{ios?'Safariの共有メニューで「ホーム画面に追加」を選べます。':'ブラウザのメニューで「アプリをインストール」または「ホーム画面に追加」を選べます。'}</p></div><button type="button" onClick={()=>{setVisible(false);try{localStorage.setItem(DISMISSED,'1');}catch{/* Hidden for this view. */}}} aria-label="ホーム画面追加の案内を閉じる">閉じる</button></aside>;
}
