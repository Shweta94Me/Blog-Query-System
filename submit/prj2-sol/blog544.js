// -*- mode: JavaScript; -*-

import mongo from 'mongodb';
import BlogError from './blog-error.js';
import Validator from './validator.js';
import assert from 'assert';
//debugger; //uncomment to force loading into chrome debugger


/**
A blog contains users, articles and comments.  Each user can have
multiple Role's from [ 'admin', 'author', 'commenter' ]. An author can
create/update/remove articles.  A commenter can comment on a specific
article.

Errors
======

DB:
  Database error

BAD_CATEGORY:
  Category is not one of 'articles', 'comments', 'users'.

BAD_FIELD:
  An object contains an unknown field name or a forbidden field.

BAD_FIELD_VALUE:
  The value of a field does not meet its specs.

BAD_ID:
  Object not found for specified id for update/remove
  Object being removed is referenced by another category.
  Other category object being referenced does not exist (for example,
  authorId in an article refers to a non-existent user).

EXISTS:
  An object being created already exists with the same id.

MISSING_FIELD:
  The value of a required field is not specified.

*/

export default class Blog544 {

  constructor(meta, options) {
    this.meta = metaInfo(meta);
    this.options = options;
    this.clientstr = this.options.client;
    this.users = this.options.users;
    this.articles = this.options.articles;
    this.comments = this.options.comments;
    this.validator = new Validator(meta);
  }


  /** options.dbUrl contains URL for mongo database */
  static async make(meta, options) {
    const mongoClient = new mongo.MongoClient(options.dbUrl,MONGO_CONNECT_OPTIONS);
    options.client = await mongoClient.connect();
    if(options.client !== undefined) {
      options.db = options.client.db('prj2-sol');
      /*New Try*/
      let indexCollection = {};
      for (const [category, fields] of Object.entries(meta)) {
        indexCollection[category] = fields.filter(f => f.doIndex).map(f => {
          return {key: {[f.name]: 1}}
        });
      }
      options.users = options.db.collection('users');
      options.articles = options.db.collection('articles');
      options.comments = options.db.collection('comments');
      await options.users.createIndexes(indexCollection.users);
      await options.articles.createIndexes(indexCollection.articles);
      await options.comments.createIndexes(indexCollection.comments);
      for (const category of Object.keys(meta)) {
        meta[category].push({
          name: '_id',
          friendlyName: 'internal mongo _id',
          forbidden: ['create', 'find', 'remove', 'update']
        });
      }
    }
    else{
        throw [new BlogError('BAD URL', 'Unable to connect to database' )];
      }
    return new Blog544(meta, options);
  }

  /** Release all resources held by this blog.  Specifically, close
   *  any database connections.
   */
  async close() {
    await this.clientstr.close();
    console.log("Connection is closed");
  }

  /** Remove all data for this blog */
  async clear() {
   await this.users.deleteMany({});
   await this.articles.deleteMany({});
   await this.comments.deleteMany({});
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   */
  async create(category, createSpecs) {
    const errors = [];
    const meta = this.meta[category];
    const obj = this.validator.validate(category, 'create', createSpecs);
    if(obj._id === undefined) obj._id = randomIDGenerator();
    //To check existence of user, article or comments
    const result = await this.find(category, {'id': obj._id});
    if(result.length !== 0){
      const msg = `object with id ${obj._id} already exist for ${category}`;
      errors.push(new BlogError('EXISTS', msg));
    }
    assert(meta);
    await this._verifyIdentifies(category, obj, meta, errors);
    if(errors.length > 0) throw errors;
    const collectionType = typeOfData(this, category);
    await collectionType.insertOne(
        obj
        , function(err, result) {
          if(err) console.log(err);
          /*console.log('1 record inserted');*/
        });
    return obj._id;
  }

  /** Find blog objects from category which meets findSpec.  
   *
   *  First returned result will be at offset findSpec._index (default
   *  0) within all the results which meet findSpec.  Returns list
   *  containing up to findSpecs._count (default DEFAULT_COUNT)
   *  matching objects (empty list if no matching objects).  _count .
   *  
   *  The _index and _count specs allow paging through results:  For
   *  example, to page through results 10 at a time:
   *    find() 1: _index 0, _count 10
   *    find() 2: _index 10, _count 10
   *    find() 3: _index 20, _count 10
   *    ...
   *  
   */
  async find(category, findSpecs={}) {
    let findInfo;
    const obj = this.validator.validate(category, 'find', findSpecs);
    const count = Number(findSpecs['_count']) || DEFAULT_COUNT;
    const index = Number(findSpecs['_index']) || DEFAULT_INDEX;
    if(findSpecs.hasOwnProperty('_count')){
      delete findSpecs['_count'];
    }
    if(findSpecs.hasOwnProperty('_index')){
      delete findSpecs['_index'];
    }
    if(findSpecs.hasOwnProperty('id')){
      findSpecs['_id'] = findSpecs['id'];
      delete findSpecs['id'];
    }

    const collectionType = typeOfData(this, category);
    let searchInfo = (findSpecs.hasOwnProperty('creationTime'))? { 'creationTime' : {$lte: new Date(findSpecs['creationTime'])}} : findSpecs;
    findInfo = await collectionType.find(searchInfo).sort({creationTime:-1}).skip(index).limit(count).toArray();
    findInfo = findInfo.map((record) => {record.id = record._id; delete record._id; return record;});

    return (findInfo.length > 0)? findInfo: [];
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    const meta = this.meta[category];
    const collectionType = typeOfData(this, category);
    let errors = [];
    const result = await this.find(category, {id: rmSpecs['id']});
    if(result.length === 0){
      const msg = `no ${category} for id ${rmSpecs.id} in remove`;
      throw [new BlogError('BAD ID', msg)];
    }
    for (const [cat, field] of meta.identifiedBy){
      const catIDs = (await this.find(cat, {[field]: rmSpecs.id})).map(val => val.id).join(',');
      if(catIDs.length > 0){
        const msg = `${category} ${rmSpecs.id} referenced by ${field}` + `for ${cat} ${catIDs}`;
        errors.push(new BlogError('BAD_ID', msg));
      }
    }
    if(errors.length > 0){
      throw errors;
    }
    collectionType.deleteOne({'_id': rmSpecs.id}, (err, result) => {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        console.log("Record removed");
    });
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    let obj = this.validator.validate(category, 'update', updateSpecs);
    const collectionType = typeOfData(this, category);
    delete obj['_id'];
    const result = await this.find(category, {id: updateSpecs['id']});
    if(result.length === 0){
      const msg = `no ${category} for id ${updateSpecs.id} in remove`;
      throw [new BlogError('BAD ID', msg)];
    }
    collectionType.updateOne({'_id': updateSpecs['id']}, {$set: obj}, function (err, result) {
      assert.equal(err, null);
      assert.equal(1, result.result.n);
      console.log("Record updated");
    });
  }

  async _verifyIdentifies(category, obj, meta, error) {
    for (const [name, otherCategory] of Object.entries(meta.identifies)) {
      const otherId = obj[name];
      if (otherId !== undefined) {
        const result = await this.find(otherCategory, { id: otherId });
        if (result !== undefined && result.length !== 1) {
          const msg = `invalid id ${otherId} for ${otherCategory} ` +
              `for create ${category}`;
          error.push(new BlogError('BAD_ID', msg));
        }
      }
    }
  }
  
}


const DEFAULT_COUNT = 5;
const DEFAULT_INDEX = 0;

const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true};

function randomIDGenerator() {
  return ((Math.random() * 1000) + 1).toFixed(4);
}


function typeOfData(obj, category){
  if(category !== undefined && category != null){
    switch (category) {
      case 'users':
        return obj.users;
      case 'articles':
        return obj.articles;
      case 'comments':
        return obj.comments;
    }
  }
  return null;
}

function metaInfo(meta) {
  const infos = {};
  for (const [category, fields] of Object.entries(meta)) {
    const indexPairs =
        fields.filter(f => f.doIndex).
        map(f => [ f.name, f.rel || 'eq' ]);
    const indexes = Object.fromEntries(indexPairs);
    const identifiesPairs =
        fields.filter(f => f.identifies).
        map(f => [ f.name, f.identifies ]);
    const identifies = Object.fromEntries(identifiesPairs);
    infos[category] = { fields, indexes, identifies, identifiedBy: [], };
  }
  for (const [category, info] of Object.entries(infos)) {
    for (const [field, cat] of Object.entries(info.identifies)) {
      infos[cat].identifiedBy.push([category, field]);
    }
  }
  return infos;
}

