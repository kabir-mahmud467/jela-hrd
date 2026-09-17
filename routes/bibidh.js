const express = require('express');
const router = express.Router();
const Bibidh = require('../models/Bibidh');
const Question = require('../models/Question');

function esc(s){ return (s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&').slice(0,100); }

const SAMPROTIK_PHASES = Question.PHASE_VALUES;

// Default category is ilmul-quran
router.get('/', async (req,res,next)=>{
  try{
    const cat = (req.query.cat||'ilmul-quran').toString().slice(0,50);
    const phase = (req.query.phase||'').toString().slice(0,50);
    const q=(req.query.q||'').toString().slice(0,100);
    const validCat = Bibidh.BIBIDH_VALUES.includes(cat) ? cat : 'ilmul-quran';
    const validPhase = Question.PHASE_VALUES.includes(phase) ? phase : '';
    const filter={};
    const and=[];
    if(q){ const rx=new RegExp(esc(q),'i'); and.push({$or:[{title:rx},{content:rx}]}) }
    and.push({category: validCat});
    if(validPhase) and.push({phase: validPhase});
    if(and.length) filter.$and=and;
    const items=await Bibidh.find(filter).sort({createdAt:-1}).limit(200).lean();
    res.render('bibidh', { items, q, cat: validCat, phase: validPhase, cats: Bibidh.BIBIDH_CATS, phases: Question.PHASES, samprotikPhases: SAMPROTIK_PHASES });
  }catch(e){ next(e); }
});

router.get('/cat/:cat', async (req,res,next)=>{
  try{
    const cat=req.params.cat.slice(0,50);
    if(!Bibidh.BIBIDH_VALUES.includes(cat)) return res.status(404).render('404');
    const phase=(req.query.phase||'').toString().slice(0,50);
    const validPhase = Question.PHASE_VALUES.includes(phase) ? phase : '';
    const filter={ category: cat };
    if(validPhase) filter.phase=validPhase;
    const items=await Bibidh.find(filter).sort({createdAt:-1}).limit(200).lean();
    res.render('bibidh', { items, q:'', cat, phase: validPhase, cats: Bibidh.BIBIDH_CATS, phases: Question.PHASES, samprotikPhases: SAMPROTIK_PHASES });
  }catch(e){ next(e); }
});

router.get('/:id', async (req,res)=>{
  try{
    const id=req.params.id;
    const mongoose=require('mongoose');
    if(!mongoose.Types.ObjectId.isValid(id)) return res.status(404).render('404');
    const item=await Bibidh.findById(id).lean();
    if(!item) return res.status(404).render('404');
    res.render('bibidh-details', { item, cats: Bibidh.BIBIDH_CATS, phases: Question.PHASES });
  }catch{ return res.status(404).render('404'); }
});

module.exports = router;
