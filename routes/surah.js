const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Surah = require('../models/Surah');
const Question = require('../models/Question');

function esc(s){ return (s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&').slice(0,100); }

function buildFilter(q, phase){
  const f={}; const and=[];
  if(q){ const rx=new RegExp(esc(q),'i'); and.push({$or:[{title:rx},{arabic:rx},{translation:rx}]}) }
  if(phase && Question.PHASE_VALUES.includes(phase)) and.push({phase});
  if(and.length) f.$and=and;
  return f;
}

router.get('/', async (req,res,next)=>{
  try{
    const q=(req.query.q||'').toString().slice(0,100);
    const phase=(req.query.phase||'').toString().slice(0,50);
    const items=await Surah.find(buildFilter(q, phase)).sort({createdAt:1}).limit(100).lean();
    res.render('surah', { items, q, phase, phases: Question.PHASES });
  }catch(e){ next(e); }
});

router.get('/porbo/:phase', async (req,res,next)=>{
  try{
    const phase=req.params.phase.slice(0,50);
    if(!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const items=await Surah.find(buildFilter('', phase)).sort({createdAt:1}).limit(100).lean();
    res.render('surah', { items, q:'', phase, phases: Question.PHASES });
  }catch(e){ next(e); }
});

router.get('/:id', async (req,res)=>{
  try{
    if(!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const item=await Surah.findById(req.params.id).lean();
    if(!item) return res.status(404).render('404');
    res.render('surah-details', { item, phases: Question.PHASES });
  }catch{ return res.status(404).render('404'); }
});

module.exports = router;
