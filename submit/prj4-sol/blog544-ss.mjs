//-*- mode: javascript -*-

import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import Path from 'path';
import mustache from 'mustache';
import querystring from 'querystring';

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';
const DEFAULT_COUNT = 5;
//emulate commonjs __dirname in this ES6 module
const __dirname = Path.dirname(new URL(import.meta.url).pathname);

export default function serve(port, ws) {
  const app = express();
  app.locals.port = port;
  app.locals.ws = ws;       //web service wrapper
  process.chdir(__dirname);
  //process.chdir((__dirname.replace(/^\//g, '')).replace(/\//g, "\\")); //so paths relative to this dir work
  setupTemplates(app);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

/******************************** Routes *******************************/

function setupRoutes(app) {
  app.use('/', express.static(STATIC_DIR));
  app.get('/search/users', doSearch(app, 'users'));
  app.get('/users', listUsers(app, 'users'));
  app.use(doErrors(app)); //must be last   
}

/****************************** Handlers *******************************/

const FIELDS_INFO = {
  id:{
    friendlyName: 'User ID',
    isSearch: true
  },
  email:{
    friendlyName: 'User Email',
    isSearch: true
  },
  firstName:{
    friendlyName: 'First Name',
    isSearch: true
  },
  lastName:{
    friendlyName: 'Last Name',
    isSearch: true
  },
  creationTime:{
    friendlyName: 'ISO Creation Time',
    isSearch: true
  },
};

const FIELDS =
    Object.keys(FIELDS_INFO).map((n) => Object.assign({name: n}, FIELDS_INFO[n]));


//@TODO: add handlers


function listUsers(app, category) {
  return async function(req,res){
    let q = req.query || {};
    if(q.hasOwnProperty('_json')){
      try{
        delete q._json;
        const objs = await app.locals.ws.list(category, q);
        await res.json(objs);
      }
      catch (err) {
        doErrors(app);
      }
    }
    else {
      const objs1 = await app.locals.ws.list(category, q);
      const html = doMustache(app, 'summary', summaryData(objs1,q));
      res.send(html);
    }
  };
}

function doSearch(app, category) {
  return async function(req, res){
    const isSubmit = req.query.submit !== undefined;
    let objs1 = {};
    let errors = undefined;
    let q;
    const search = getNonEmptyValues(req.query);
    if(isSubmit){
      errors = validate(search);
      if(Object.keys(search).length === 0){
        const msg = 'One or more values must be specified.';
        errors = Object.assign(errors || {}, { _: msg });
      }
      if(!errors){
        q = search || {};
        try {
          objs1 = await app.locals.ws.list(category, q);
        }
        catch (err) {
          console.error(err);
          errors = wsErrors(err);
        }
        if (objs1.users !== undefined && Object.keys(objs1.users).length === 0
            && objs1.constructor === Object && Object.keys(errors).length === 0) {
          errors = {_: 'No users found for specified query.'};
        }
      }
    }
    let model, template;
    if (Object.keys(objs1).length > 0 && objs1.users.length > 0) {
      let requestQuery = querystring.stringify(q);
      res.redirect('/users?'+ requestQuery);
    }
    else {
      template =  'search';
      model = errorModel(app, search, errors);
      const html = doMustache(app, template, model);
      res.send(html);
    }
  };
}

function summaryData(objs1, query) {
  let model = {};
  let fields = {};
  if (Object.keys(objs1).length > 0 && objs1.users.length > 0) {
    fields =
        objs1.users.map((obj) => {
          const obj1 = Object.assign({}, obj);
          obj.roles = obj1.roles.map((x) => {
            return {name: x}
          });
          obj.creationTime = convertISODateToMMDDYYYY(obj1.creationTime);
          obj.updateTime = convertISODateToMMDDYYYY(obj1.updateTime);
          return obj;
        });
  }
    let nextFlag = false;
    let prevFlag = false;
    let next = '';
    let prev = '';
    if (objs1.hasOwnProperty('next')) {
      nextFlag = true;
      query._index = objs1.next;
      next = querystring.stringify(query);
    }
    if (objs1.hasOwnProperty('prev')) {
      prevFlag = true;
      query._index = objs1.prev;
      prev = querystring.stringify(query);
    }
    model = {users: fields, next:nextFlag? next: false, prev:prevFlag? prev: false};
    return model;
}

function doErrors(app) {
  return async function(err, req, res, next) {
    console.log('doErrors()');
    const errors = [ `Server error` ];
    const html = doMustache(app, `errors`, {errors, });
    res.send(html);
    console.error(err);
  };
}

/************************ General Utilities ****************************/

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function fieldsWithValues(values, errors={}) {
  return FIELDS.map(function (info) {
    const name = info.name;
    let extraInfo = {};
    if(name === "id"){
      extraInfo.id = "userId";
      extraInfo.divError = "userIdErr";
    }
    else {
      extraInfo.id = `${name}`;
      extraInfo.divError = false;
    }
    extraInfo.value = values[`${name}`];
    if (errors[`${name}`]) extraInfo.errorMessage = errors[`${name}`];
    return Object.assign(extraInfo, info);
  });
}

/** Return a model suitable for mixing into a template */
function errorModel(app, values={}, errors={}) {
  return {
    errors: errors._,
    fields: fieldsWithValues(values, errors)
  };
}

function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      console.log('errorWrap()');
      next(err);
    }
  };
}

function isNonEmpty(v) {
  return (v !== undefined) && v.trim().length > 0;

}

function getNonEmptyValues(values) {
  const out = {};
  Object.keys(values).forEach(function(k) {
    if (FIELDS_INFO[k] !== undefined) {
      const v = values[k];
      if (v && v.trim().length > 0) out[k] = v.trim();
    }
  });
  return out;
}

function validate(values, requires=[]) {
  const errors = {};
  requires.forEach(function (name) {
    if (values[name] === undefined) {
      errors[name] =
          `A value for '${FIELDS_INFO[name].friendlyName}' must be provided`;
    }
  });
  return Object.keys(errors).length > 0 && errors;
}

function wsErrors(err) {
  let msg = {};
  if(err.errors.length > 0){
    err.errors.forEach((errMsg)=>{
      msg[`${errMsg.name}`] = errMsg.message;
    });
  }
  else {
    msg._ = 'web service error';
  }
  console.error(msg);
  return msg;
}

/************************ Mustache Utilities ***************************/

function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

function setupTemplates(app) {
  app.templates = {};
  for (let fname of fs.readdirSync(TEMPLATES_DIR)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);f
      process.exit(1);
    }
  }
}

function convertISODateToMMDDYYYY(ISODate){
  let dt = new Date(ISODate);
  return dt.toLocaleDateString();
}