const express = require('express');
const router = express.Router();
const Bibidh = require('../models/Bibidh');
const { isDBError } = require('../config/db');

function esc(s){ return (s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&').slice(0,100); }

// Default category is ilmul-quran
router.get('/', async (req,res,next)=>{
  try{
    const cat = (req.query.cat||'ilmul-quran').toString().slice(0,50);
    const q=(req.query.q||'').toString().slice(0,100);
    const validCat = Bibidh.BIBIDH_VALUES.includes(cat) ? cat : 'ilmul-quran';
    const filter={ category: validCat };
    if(q){ const rx=new RegExp(esc(q),'i'); filter.$and=[{category: validCat},{$or:[{title:rx},{content:rx}]}]; }
    const items=await Bibidh.find(filter).sort({createdAt:-1}).limit(200).lean();
    res.render('bibidh', { items, q, cat: validCat, cats: Bibidh.BIBIDH_CATS });
  }catch(e){ next(e); }
});

router.get('/cat/:cat', async (req,res,next)=>{
  try{
    const cat=req.params.cat.slice(0,50);
    if(!Bibidh.BIBIDH_VALUES.includes(cat)) return res.status(404).render('404');
    const items=await Bibidh.find({ category: cat }).sort({createdAt:-1}).limit(200).lean();
    res.render('bibidh', { items, q:'', cat, cats: Bibidh.BIBIDH_CATS });
  }catch(e){ next(e); }
});

router.get('/:id', async (req,res,next)=>{
  try{
    const id=req.params.id;
    const mongoose=require('mongoose');
    if(!mongoose.Types.ObjectId.isValid(id)) return res.status(404).render('404');
    const item=await Bibidh.findById(id).lean();
    if(!item) return res.status(404).render('404');
    res.render('bibidh-details', { item, cats: Bibidh.BIBIDH_CATS });
  }catch(err){
    // DB blip হলে 404 নয় — 503 retry পেজ (error handler দেখো)
    if(isDBError(err)) return next(err);
    return res.status(404).render('404');
  }
});

module.exports = router;
