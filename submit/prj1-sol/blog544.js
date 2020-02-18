// -*- mode: JavaScript; -*-

import BlogError from './blog-error.js';
import Validator from './validator.js';

//debugger; //uncomment to force loading into chrome debugger

/**
A blog contains users, articles and comments.  Each user can have
multiple Role's from [ 'admin', 'author', 'commenter' ]. An author can
create/update/remove articles.  A commenter can comment on a specific
article.

Errors
======

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
    //@TODO
    this.globalUser = [];
    this.globalArticle = [];
    this.globalComments = [];
    this.meta = meta;
    this.options = options;
    this.validator = new Validator(meta);
  }

  static async make(meta, options) {
    //@TODO
    return new Blog544(meta, options);
  }

  /** Remove all data for this blog */
  async clear() {
    //@TODO
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   */
  async create(category, createSpecs) {
    
    const obj = this.validator.validate(category, 'create', createSpecs);
    let results;
    if(category === 'users'){
      results = this.globalUser.filter(d => d.id === obj.id);
    }

    if(results != null && results.length > 0){
      throw [new BlogError('EXISTS', 'object with id ' + obj.id + ' already exists for '+category)];
    }
    else if(obj !== undefined && obj !== null && createSpecs != null){
      if(!this.options.noLoad) {
        switch (category) {
          case 'users':
            this.globalUser.push(obj);
            break;
          case 'articles':
            if(checkAuthorExist(this, category, obj)){
              obj.id = randomIDGenerator();
              this.globalArticle.push(obj);
            }
            else {
              throw [new BlogError('BAD_ID', 'invalid id '+ obj.authorId  + ' for users for create articles')];
            }
            break;
          case 'comments':
            if(!checkAuthorExist(this, category, obj)){
              throw [new BlogError('BAD_ID', 'invalid id '+ obj.commenterId  + ' for user for create comments')];
            }
            else if(!checkArticleExist(this, obj)){
              throw [new BlogError('BAD_ID', 'invalid id '+ obj.articleId  + ' for article for create comments')];
            }
            else {
              obj.id = randomIDGenerator();
              this.globalComments.push(obj);
            }
            break;
        }
        return obj.id;
      }
    }
    //@TODO
  }

  /** Find blog objects from category which meets findSpec.  Returns
   *  list containing up to findSpecs._count matching objects (empty
   *  list if no matching objects).  _count defaults to DEFAULT_COUNT.
   */
  async find(category, findSpecs={}) {
    let findInfo = [];
    let key;
    const obj = this.validator.validate(category, 'find', findSpecs);
    if(obj !== undefined){
      let dataType = typeOfData(this, category);
      if(isEmpty(findSpecs)){
        findInfo = dataType.slice(0, DEFAULT_COUNT);
      }
      else{
        key = Object.keys(findSpecs);
        if(key.length === 1 && key.includes('_count')){
          findInfo = dataType;//for eg.: find users _count
        }
        else if(!key.includes('keywords')){
          findInfo = dataType.filter(function (e) {
            return e[key[0]] === findSpecs[key[0]];
          });//for eg. find users id=betty or find users id=betty _count=3
          if(!key.includes('id')){
            console.log(key[0] +' : '+ findInfo.length);
          }
        }
        else if(key.includes('keywords')){
          let arr = [], arr1 = [];
          findSpecs.keywords.forEach(function (val) {
            let arr2 = dataType.filter(article => article.keywords.includes(val));
            arr.push(arr2);
            arr1.push(arr2.length);
          });
          findInfo = arr.reduce((join, current) => join.filter(el => current.includes(el)));

          arr1.forEach(val => console.log('keywords: '+ val));
        }
        if(hasCountProp(findSpecs)){
          findInfo = findInfo.slice(0, findSpecs._count);
        }
        else {
          findInfo = findInfo.slice(0, DEFAULT_COUNT);
        }
      }
      if(findInfo.length === 0 && (isEmpty(findSpecs) || ((Object.keys(findSpecs)).length === 1 && (Object.keys(findSpecs)).includes('_count')))){
        throw [new BlogError('BAD_ID', 'No data available for '+category)];
      }
      else if(findInfo.length === 0){
        throw [new BlogError('BAD_ID', 'no '+ category+' for id ' + (Object.values(findSpecs))[0])];
      }
      return findInfo;
    }
    //@TODO
    //return [];
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    let results;
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    if(obj !== undefined){
      let dataType = typeOfData(this, category);
      results = await this.find(category, {id:rmSpecs['id']});
      if((category === 'users' && removeUser(this,results, rmSpecs)) ||
          (category === 'articles' && removeArticle(this,results, rmSpecs)) ||
          category === 'comments'){
        let index = dataType.findIndex(function(item, i){
          return item.id === rmSpecs['id'];
        });
        dataType.splice(index, 1);
      }
    }
    //@TODO
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    let index;
    const obj = this.validator.validate(category, 'update', updateSpecs);
    if(obj !== undefined && obj != null){
      let dataType = typeOfData(this, category);
      index = dataType.findIndex(function(item, i){
        return item.id === updateSpecs['id'];
      });
      if(index !== -1){
        (Object.keys(updateSpecs)).slice(1).forEach(key=> dataType[index][key] = updateSpecs[key]);
        dataType[index].updateTime = new Date();
      }
      else {
        throw [new BlogError('BAD_FIELD', 'unknown '+category+ ' field')];
      }
      //@TODO
    }
  }
}

const DEFAULT_COUNT = 5;

function randomIDGenerator() {
  return ((Math.random() * 100) + 1).toFixed(3);
}
function isEmpty(obj) {
  for(let key in obj) {
      if(obj.hasOwnProperty(key))
          return false;
  }
  return true;
}

function typeOfData(obj, category){
  if(category !== undefined && category != null){
    switch (category) {
      case 'users':
        return obj.globalUser;
      case 'articles':
        return obj.globalArticle;
      case 'comments':
        return obj.globalComments;
    }
  }
  return null;
}

function hasCountProp(findSpecs) {
  return findSpecs.hasOwnProperty('_count');
}

function removeUser(obj,results,rmSpecs){
  let articleIDs = [];
  let commentIDs = [];
  let errors = [];
  let role = Array.from(results[0].roles);
  let that = obj;
  if(role !== undefined && role.length > 0){
    role.forEach(function (item) {
      switch (item) {
        case 'author':
          that.globalArticle.filter(function (data) {
            if(data.authorId === rmSpecs.id) articleIDs.push(data.id);
          });
          break;
        case 'commenter':
          that.globalComments.filter( function (data){
            if(data.commenterId === rmSpecs.id) commentIDs.push(data.id);
          });
          break;
      }
    });

    if(articleIDs.length > 0) console.log('articleID: '+articleIDs.length);
    if(commentIDs.length > 0) console.log('commentID: '+commentIDs.length);
    if(articleIDs.length > 0){
      const msg = 'users '+ rmSpecs['id'] +' referenced by authorId for articles ' + articleIDs.toString() +'\n';
      errors.push(new BlogError('BAD_ID', msg));
    }
    if(commentIDs.length > 0){
      const msg = 'users '+ rmSpecs['id'] +' referenced by commenterId  for comments ' + commentIDs.toString();
      errors.push(new BlogError('BAD_ID', msg));
    }
  }

  if(errors.length > 0){
    throw  errors;
  }
  return true;
}

function removeArticle(obj,results,rmSpecs) {
  let commentIDs = [];

  obj.globalComments.filter( function (data){
    if(data.articleId === rmSpecs.id) commentIDs.push(data.id);
  });

  if(commentIDs.length > 0) {
    console.log('commentID: '+commentIDs.length);
    const msg = 'articles '+ rmSpecs['id'] +' referenced by articleId  for comments ' + commentIDs.toString();
    throw [new BlogError('BAD_ID', msg)];
  }
  return true;
}

function checkAuthorExist(obj, category, jsonObj) {
  let findInfo = [];
  if(category === 'articles'){
    findInfo = obj.globalUser.filter(d => d.id === jsonObj.authorId);
  }
  else if(category === 'comments'){
    findInfo = obj.globalUser.filter(d => d.id === jsonObj.commenterId);
  }
  if(findInfo !== undefined && findInfo.length > 0){
    if(category === 'articles' && findInfo[0].roles.includes('author')){
      return true;
    }
    else if(category === 'comments' && findInfo[0].roles.includes('commenter')){
      return true;
    }
  }
  return false;
}

function checkArticleExist(obj, jsonObj) {
  let findArticleInfo = [];
  findArticleInfo = obj.globalArticle.filter(d => d.id === jsonObj.articleId);
  return findArticleInfo !== undefined && findArticleInfo.length > 0;
}
//You can add code here and refer to it from any methods in Blog544.
