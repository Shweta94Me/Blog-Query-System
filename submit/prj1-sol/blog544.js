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

    const results = await this.find(category, {id:createSpecs['id']});
    if(results.length > 0){
      var value = createSpecs['id'];
      const msg = 'object with id ${value} already exists for ${category}';
      throw [new BlogError('EXISTS', msg)];
    }
    else if(category == 'users' && obj != undefined && obj != null && createSpecs != null){
      var jsonContent = JSON.stringify(createSpecs);
      var jsonObj = JSON.parse(jsonContent);
      this.globalUser.push(jsonObj);
      if(!this.options.noLoad){
        console.log(createSpecs['id']);
      }
    }
    //@TODO
  }

  /** Find blog objects from category which meets findSpec.  Returns
   *  list containing up to findSpecs._count matching objects (empty
   *  list if no matching objects).  _count defaults to DEFAULT_COUNT.
   */
  async find(category, findSpecs={}) {
    var count = 0;
    var findInfo;
    const obj = this.validator.validate(category, 'find', findSpecs);
    if(obj != undefined && obj != null){
      if(isEmpty(findSpecs) && category == 'users'){
        findInfo = this.globalUser.map( function(type){
          var info = {
                      "id" : type.id
                      }
          return info;
        });
      }
      else{
        findInfo = this.globalUser.filter(d => d.id === findSpecs.id);
      }
      // if(findInfo != undefined && findInfo != null && findInfo.length > 0){
      //   console.log(findInfo);
      // } 
      return findInfo;
    }
    //@TODO
    return [];
  }


  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    //@TODO
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    if(obj != undefined && obj != null){
      // for(var i = 0; i < this.globalUser.length; i++){
      //   if(this.globalUser[i].id == updateSpecs['id']){
          // for(var key in updateSpecs){
          //   if(key != 'id'){
          //     switch(key){
          //       case 'firstName':
          //         this.globalUser[i].firstName = updateSpecs['firstName'];
          //         break;
          //       case 'lastName' :
          //         this.globalUser[i].lastName = updateSpecs['lastName'];
          //         break;
          //       case 'roles':
          //         this.globalUser[i].roles = updateSpecs['roles'];
          //         break;
          //       case 'updateTime':
          //         this.globalUser[i].updateTime = updateSpecs['updateTime'];
          //         break;
          //     }
          //     //this.globalUser[i].key = updateSpecs[key];
          //   }
          // }
      //     break;
      //   }
      // }
      //var findInfo = await this.find(category, {id:updateSpecs['id']});
      var index = this.globalUser.findIndex(function(item, i){
        return item.id === updateSpecs['id'];
      })
      Object.keys(updateSpecs).forEach(key=> this.globalUser[index].key = updateSpecs[key]);
      //@TODO
    }
  }
}
  

function isEmpty(obj) {
  for(var key in obj) {
      if(obj.hasOwnProperty(key))
          return false;
  }
  return true;
}
//You can add code here and refer to it from any methods in Blog544.
