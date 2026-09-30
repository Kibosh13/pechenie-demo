'use strict';
const config=JSON.parse(document.getElementById('site-data').textContent);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const form=$('#order-form'), messages=config.form;
const qty=Object.fromEntries(config.products.map(p=>[p.id,0]));
const rub=n=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2}).format(n/100);
let csrfToken='',csrfPromise, appliedPromo='',discount=0,total=0,requestId=crypto.randomUUID(),sending=false,quoteEpoch=0;
async function session(){if(csrfToken)return csrfToken;if(!csrfPromise)csrfPromise=fetch('/api/?action=session',{credentials:'same-origin',cache:'no-store'}).then(r=>{if(!r.ok)throw Error(messages.errorNetwork);return r.json();}).then(r=>csrfToken=r.csrf).finally(()=>csrfPromise=null);return csrfPromise;}
async function api(action,data){const token=await session();const r=await fetch('/api/?action='+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(data)});let value;try{value=await r.json();}catch{throw Error(messages.errorNetwork);}if(!r.ok){if(r.status===403)csrfToken='';throw Error(value.error||messages.errorNetwork);}return value;}
function items(){return config.products.filter(p=>qty[p.id]>0).map(p=>({id:p.id,quantity:qty[p.id]}));}
function changed(){requestId=crypto.randomUUID();$('#form-result').hidden=true;$('#form-error').hidden=true;}
function update(){
 const count=Object.values(qty).reduce((a,b)=>a+b,0);const subtotal=config.products.reduce((sum,p)=>sum+Math.round(p.price*100)*qty[p.id],0);total=subtotal-discount;
 $$('[data-quantity]').forEach(el=>el.value=qty[el.dataset.quantity]);$$('[data-step]').forEach(el=>el.disabled=+el.dataset.step===-1?qty[el.dataset.product]===0:qty[el.dataset.product]>=999);
 $$('[data-add]').forEach(el=>el.hidden=qty[el.dataset.add]>0);$$('[data-catalog-stepper]').forEach(el=>el.hidden=qty[el.dataset.catalogStepper]===0);
 $$('[data-cart-count]').forEach(el=>{el.hidden=!count;el.textContent=count;});$('#total-count').textContent=count+' '+messages.countUnit;$('#total-price').textContent=rub(total);$('#discount-line').hidden=!discount;$('#discount-amount').textContent='−'+rub(discount);$('[data-floating-total]').hidden=!count;$('[data-floating-total]').textContent=count+' '+messages.countUnit+' · '+rub(total);
}
function setQuantity(id,value){if(sending)return;qty[id]=Math.max(0,Math.min(999,Math.floor(Number(value)||0)));discount=0;appliedPromo='';quoteEpoch++;$('#promo-message').hidden=true;changed();update();}
$$('[data-add]').forEach(el=>el.addEventListener('click',()=>setQuantity(el.dataset.add,1)));$$('[data-step]').forEach(el=>el.addEventListener('click',()=>setQuantity(el.dataset.product,qty[el.dataset.product]+Number(el.dataset.step))));$$('[data-quantity]').forEach(el=>el.addEventListener('input',()=>setQuantity(el.dataset.quantity,el.value)));
async function applyPromo(){
 if(sending)return;const epoch=++quoteEpoch;const message=$('#promo-message');message.hidden=false;
 if(config.static){message.textContent='Промокоды доступны на основном сайте.';return;}
 $('#apply-promo').disabled=true;
 try{const result=await api('quote',{items:items(),promo:$('#promo-code').value});if(epoch!==quoteEpoch)return;appliedPromo=result.promo;discount=result.discount;changed();update();message.textContent=appliedPromo?'Промокод применён. Скидка '+rub(discount):'Введите промокод.';}catch(e){if(epoch===quoteEpoch){appliedPromo='';discount=0;update();message.textContent=e.message;}}finally{$('#apply-promo').disabled=false;}
}
$('#apply-promo').addEventListener('click',applyPromo);$('#promo-code').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyPromo();}});$('#promo-code').addEventListener('input',()=>{quoteEpoch++;appliedPromo='';discount=0;$('#promo-message').hidden=true;changed();update();});
form.addEventListener('input',e=>{if(!sending)changed();if(e.target.name==='delivery')$('#method-note').textContent=messages[e.target.value+'Note'];});
form.addEventListener('submit',async e=>{
 e.preventDefault();if(sending)return;const error=$('#form-error');error.hidden=true;$('#form-result').hidden=true;
 try{
  if(config.static)throw Error('Отправить заявку можно на основном сайте: печеньевстакане.рф.');
  const values=new FormData(form),name=String(values.get('name')||'').trim(),contact=String(values.get('contact')||'').trim();
  if(!items().length)throw Error(messages.errorEmpty);if(name.length<2)throw Error(messages.errorName);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)&&!(/^[+\d()\s-]+$/.test(contact)&&contact.replace(/\D/g,'').length>=10&&contact.replace(/\D/g,'').length<=15))throw Error(messages.errorContact);
  if(!values.get('consent'))throw Error(messages.errorConsent);
  sending=true;quoteEpoch++;form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);$('#submit-order span').textContent=messages.sending;
  const result=await api('order',{items:items(),promo:appliedPromo,expectedTotal:total,requestId,name,contact,comment:String(values.get('comment')||''),audience:values.get('audience'),delivery:values.get('delivery'),consent:true,consentVersion:config.consentVersion,website:values.get('website')});
  $('#form-result-title').textContent=messages.successTitle+' № '+result.id;$('#form-result').hidden=false;$('#form-result').focus();form.reset();Object.keys(qty).forEach(k=>qty[k]=0);discount=0;appliedPromo='';update();requestId=crypto.randomUUID();
 }catch(e){error.textContent=e.message||messages.errorNetwork;error.hidden=false;}finally{sending=false;form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=false);update();$('#submit-order span').textContent=messages.submit;}
});
const toggle=$('.menu-toggle'),menu=$('#mobile-navigation');
function closeMenu(focus=false){toggle.setAttribute('aria-expanded','false');menu.hidden=true;if(focus)toggle.focus();}
toggle.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));});
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>closeMenu()));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden)closeMenu(true);});document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('.site-header'))closeMenu();});window.matchMedia('(min-width:761px)').addEventListener('change',e=>{if(e.matches)closeMenu();});
new IntersectionObserver(([entry])=>{const el=$('.floating-order');el.classList.toggle('is-hidden',entry.isIntersecting);el.setAttribute('aria-hidden',String(entry.isIntersecting));el.tabIndex=entry.isIntersecting?-1:0;}).observe($('#order'));
update();
