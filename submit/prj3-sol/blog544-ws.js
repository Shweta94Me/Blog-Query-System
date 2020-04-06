import assert from 'assert';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import querystring from 'querystring';

import BlogError from './blog-error.js';

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

export default function serve(port, meta, model) {
  const app = express();
  app.locals.port = port;
  app.locals.meta = meta;
  app.locals.model = model;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

function setupRoutes(app) {
  app.use(cors());
  app.use(bodyParser.json());
  app.get('/', doList(app));
  app.get('/meta', getMeta(app));

  app.get('/users/:id', getRecordData('users',app));
  app.get('/articles/:id', getRecordData('articles', app));
  app.get('/comments/:id', getRecordData('comments', app));

  app.get('/users', getData('users',app));
  app.get('/articles', getData('articles', app));
  app.get('/comments', getData('comments', app));

  app.post('/users', doCreate('users', app));
  app.post('/articles', doCreate('articles', app));
  app.post('/comments', doCreate('comments', app));

  app.delete('/users/:id', deleteData('users',app));
  app.delete('/articles/:id', deleteData('articles', app));
  app.delete('/comments/:id', deleteData('comments', app));

  app.patch('/users/:id', updateData('users', app));
  app.patch('/articles/:id', updateData('articles', app));
  app.patch('/comments/:id', updateData('comments', app));

  app.use(doErrors());
}

/****************************** Handlers *******************************/

function doList(app) {
  return errorWrap(function(req, res){
    try{
      let obj = {};
      let requestedLinkType = ["self", "meta", "collections"];
      let collectionArr = Object.keys(app.locals.meta);
      obj.links = getHATEOASLink(req, requestedLinkType, collectionArr);
      res.json(obj);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

function getMeta(app){
  return errorWrap(function (req, res) {
      try{
        let info = Object.assign({}, app.locals.meta);
        info.links = getHATEOASLink(req, ["uniqueLinkForRecord"]);
        res.json(info);
      }
      catch (err) {
        const mapped = mapError(err);
        res.status(mapped.status).json(mapped);
      }
  })
}

function getData(category, app){
  return errorWrap(async function (req, res) {
    try{
      let results = {};
      results[category] = await app.locals.model.find(category, req.query);
      results[category] = results[category].map((val)=> ({...val, links : getHATEOASLink(req, ["uniqueLinkForRecord"], [], "", val.id, 0)}));
      results.links = getHATEOASLink(req,["self", "nextprev"],[],"","",results[category].length);
      results.links.forEach((val) => {
        if(val.rel !== undefined && val.rel === "prev"){
          results.prev = Number(getParamsFromURL("_index", val.url));
        }
        if(val.rel !== undefined && val.rel === "next"){
          results.next = Number(getParamsFromURL("_index", val.url));
        }
      });
      await res.json(results);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function getRecordData(category, app) {
  return errorWrap(async function (req, res) {
    try{
      let info = {};
      info[category] = await app.locals.model.find(category, req.params);
      info[category] = info[category].map((val)=> ({...val, links : getHATEOASLink(req, ["uniqueLinkForRecord"])}));
      await res.json(info);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doCreate(category, app) {
  return errorWrap(async function (req, res) {
    try{
      const obj = req.body;
      const results = await app.locals.model.create(category, obj);
      res.append('Location', requestUrl(req) + '/'+ results);
      res.json({});
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

function deleteData(category, app) {
  return errorWrap(async function(req, res){
    try{
      const id = req.params.id;
      const results = await app.locals.model.remove(category, {id:id});
      res.json({});
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

function updateData(category, app) {
  return errorWrap(async function(req, res){
    try{
      const patch = Object.assign({}, req.body);
      patch.id = req.params.id;
      const results = await app.locals.model.update(category, patch);
      res.json({});
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}
/**************************** Error Handling ***************************/

/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    await res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

const ERROR_MAP = {
  BAD_CATEGORY: NOT_FOUND,
  EXISTS: CONFLICT,
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return (err instanceof Array && err.length > 0 && err[0] instanceof BlogError)
    ? { status: (ERROR_MAP[err[0].code] || BAD_REQUEST),
	code: err[0].code,
	message: err.map(e => e.message).join('; '),
      }
    : { status: SERVER_ERROR,
	code: 'INTERNAL',
	message: err.toString()
      };
} 

/****************************** Utilities ******************************/

/** Return original URL for req (excluding query params)
 *  Ensures that url does not end with a /
 */
function requestUrl(req) {
  const port = req.app.locals.port;
  const url = req.originalUrl.replace(/\/?(\?.*)?$/, '');
  return `${req.protocol}://${req.hostname}:${port}${url}`;
}

function getHATEOASLink(req, requestedLinkType, collectionArr = [], category = "", id = "", resultCount = 0) {
  let obj = [];
  let link = {};
  let paramsObj;
  if(requestedLinkType.length > 0){
    requestedLinkType.forEach(function (element) {
      if(element === "self"){
        obj.push({rel:"self", name: "self", url: `${req.protocol}://${req.hostname}:${req.app.locals.port}${req.originalUrl}`});
      }
      if(element === "meta"){
        obj.push({url:requestUrl(req) + "/meta", name: "meta", rel: "describeby"});
      }
      if(element === "collections"){
        collectionArr.forEach((category) => obj.push({rel:"collection", name: `${category}`, url: requestUrl(req) + `/${category}`}));
      }
      if(element === "uniqueLinkForRecord"){
        (id !== "")? obj.push({href: requestUrl(req) + `/${id}`, name:"self", rel:"self"}): obj.push({href: requestUrl(req), name:"self", rel:"self"});
      }
      if(element === "nextprev"){
        const urlstring = req.originalUrl.replace(/\/?(\?.*)?$/, '');
        if(!req.query.hasOwnProperty('_index') && !req.query.hasOwnProperty('_count') && resultCount >= DEFAULT_COUNT){
          link.rel = "next";
          link.name = "next";
          paramsObj = Object.assign({}, req.query);
          paramsObj._index = DEFAULT_COUNT;
          link.url = `${req.protocol}://${req.hostname}:${req.app.locals.port}${urlstring}` + '?' + querystring.stringify(paramsObj);
          obj.push(link);
        }
        else if(!req.query.hasOwnProperty('_index')  && req.query.hasOwnProperty('_count') && resultCount >= req.query._count && resultCount !== 0){
          link.rel = "next";
          link.name = "next";
          paramsObj = Object.assign({}, req.query);
          paramsObj._index = paramsObj._count;
          link.url = `${req.protocol}://${req.hostname}:${req.app.locals.port}${urlstring}` + '?' + querystring.stringify(paramsObj);
          obj.push(link);
        }
        else if(req.query.hasOwnProperty('_index')){
          paramsObj = Object.assign({}, req.query);
          let count =
              paramsObj._count !== undefined? Number(paramsObj._count) : DEFAULT_COUNT;
          if(resultCount >= count && resultCount !== 0){
            paramsObj._index = (Number(paramsObj._index) + count).toString();
            obj.push({rel:"next", name:"next", url:`${req.protocol}://${req.hostname}:${req.app.locals.port}${urlstring}` + '?' + querystring.stringify(paramsObj)});
          }
          if(Number(req.query._index) !== 0){
            paramsObj._index = ((Number(req.query._index) - (count)) >= 0)? (Number(req.query._index) - (count)).toString(): '0';
            obj.push({rel:"prev", name:"prev", url:`${req.protocol}://${req.hostname}:${req.app.locals.port}${urlstring}` + '?' + querystring.stringify(paramsObj)});
          }
        }
      }
    });
  }
  return obj;
}

function getParamsFromURL(params, url){
  let href = url;
  let reg = new RegExp('[?&]' + params + '=([^&#]*)', 'i');
  let querystr = reg.exec(href);
  return querystr? querystr[1]:null;
}

const DEFAULT_COUNT = 5;

