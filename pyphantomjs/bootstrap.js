/*jslint sloppy: true, nomen: true */
/*global window:true,phantom:true,fs:true */

/*
  This file is part of the PhantomJS project from Ofi Labs.

  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2011 Ivan De Marino <ivan.de.marino@gmail.com>
  Copyright (C) 2011 James Roe <roejames12@hotmail.com>
  Copyright (C) 2011 execjosh, http://execjosh.blogspot.com

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the <organization> nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

function require(name) {

    var exports;

    if (name === 'webpage') {

        exports = function (opts) {
            var page = phantom.createWebPage(),
                handlers = {};

            function checkType(o, type) {
                return typeof o === type;
            }

            function isObject(o) {
                return checkType(o, 'object');
            }

            function isUndefined(o) {
                return checkType(o, 'undefined');
            }

            function isUndefinedOrNull(o) {
                return isUndefined(o) || null === o;
            }

            function copyInto(target, source) {
                if (target === source || isUndefinedOrNull(source)) {
                    return target;
                }

                target = target || {};

                // Copy into objects only
                if (isObject(target)) {
                    // Make sure source exists
                    source = source || {};

                    if (isObject(source)) {
                        var i, newTarget, newSource;
                        for (i in source) {
                            if (source.hasOwnProperty(i)) {
                                newTarget = target[i];
                                newSource = source[i];

                                if (newTarget && isObject(newSource)) {
                                    // Deep copy
                                    newTarget = copyInto(target[i], newSource);
                                } else {
                                    newTarget = newSource;
                                }

                                if (!isUndefined(newTarget)) {
                                    target[i] = newTarget;
                                }
                            }
                        }
                    } else {
                        target = source;
                    }
                }

                return target;
            }

            function defineSetter(handlerName, signalName) {
                page.__defineSetter__(handlerName, function (f) {
                    if (handlers && typeof handlers[signalName] === 'function') {
                        try {
                            this[signalName].disconnect(handlers[signalName]);
                        } catch (e) {}
                    }
                    handlers[signalName] = f;
                    this[signalName].connect(handlers[signalName]);
                });
            }

            // deep copy
            page.settings = JSON.parse(JSON.stringify(phantom.defaultPageSettings));

            defineSetter("onInitialized", "initialized");

            defineSetter("onLoadStarted", "loadStarted");

            defineSetter("onLoadFinished", "loadFinished");

            defineSetter("onResourceRequested", "resourceRequested");

            defineSetter("onResourceReceived", "resourceReceived");

            defineSetter("onAlert", "javaScriptAlertSent");

            defineSetter("onConsoleMessage", "javaScriptConsoleMessageSent");

            page.open = function (url, arg1, arg2, arg3, arg4) {
                if (arguments.length === 1) {
                    this.openUrl(url, 'get', this.settings);
                    return;
                }
                if (arguments.length === 2 && typeof arg1 === 'function') {
                    this.onLoadFinished = arg1;
                    this.openUrl(url, 'get', this.settings);
                    return;
                } else if (arguments.length === 2) {
                    this.openUrl(url, arg1, this.settings);
                    return;
                } else if (arguments.length === 3 && typeof arg2 === 'function') {
                    this.onLoadFinished = arg2;
                    this.openUrl(url, arg1, this.settings);
                    return;
                } else if (arguments.length === 3) {
                    this.openUrl(url, {
                        operation: arg1,
                        data: arg2
                    }, this.settings);
                    return;
                } else if (arguments.length === 4) {
                    this.onLoadFinished = arg3;
                    this.openUrl(url, {
                        operation: arg1,
                        data: arg2
                    }, this.settings);
                    return;
                }
                throw "Wrong use of WebPage#open";
            };

            page.includeJs = function (scriptUrl, onScriptLoaded) {
                // Register temporary signal handler for 'alert()'
                this.javaScriptAlertSent.connect(function (msgFromAlert) {
                    if (msgFromAlert === scriptUrl) {
                        // Resource loaded, time to fire the callback
                        onScriptLoaded(scriptUrl);
                        // And disconnect the signal handler
                        try {
                            this.javaScriptAlertSent.disconnect(arguments.callee);
                        } catch (e) {}
                    }
                });

                // Append the script tag to the body
                this._appendScriptElement(scriptUrl);
            };

            // Copy options into page
            if (opts) {
                page = copyInto(page, opts);
            }

            return page;
        };
    }

    if (name === 'fs') {

        exports = phantom.createFilesystem();

        // JavaScript "shim" to throw exceptions in case a critical operation fails.

        /** Open and return a "file" object.
         * It will throw exception if it fails.
         *
         * @param path Path of the file to open
         * @param mode Open Mode. A string made of 'r', 'w', 'a/+' characters.
         * @return "file" object
         */
        exports.open = function (path, mode) {
            var file = exports._open(path, mode);
            if (file) {
                return file;
            }
            throw "Unable to open file '" + path + "'";
        };

        /** Open, read and return content of a file.
         * It will throw an exception if it fails.
         *
         * @param path Path of the file to read from
         * @return file content
         */
        exports.read = function (path) {
            var f = fs.open(path, 'r'),
                content = f.read();

            f.close();
            return content;
        };

        /** Open and write content to a file
         * It will throw an exception if it fails.
         *
         * @param path Path of the file to read from
         * @param content Content to write to the file
         * @param mode Open Mode. A string made of 'w' or 'a / +' characters.
         */
        exports.write = function (path, content, mode) {
            var f = fs.open(path, mode);

            f.write(content);
            f.close();
        };

        /** Return the size of a file, in bytes.
         * It will throw an exception if it fails.
         *
         * @param path Path of the file to read the size of
         * @return File size in bytes
         */
        exports.size = function (path) {
            var size = fs._size(path);
            if (size !== -1) {
                return size;
            }
            throw "Unable to read file '" + path + "' size";
        };

        /** Copy a file.
         * It will throw an exception if it fails.
         *
         * @param source Path of the source file
         * @param destination Path of the destination file
         */
        exports.copy = function (source, destination) {
            if (!fs._copy(source, destination)) {
                throw "Unable to copy file '" + source + "' at '" + destination + "'";
            }
        };

        /** Copy a directory tree.
         * It will throw an exception if it fails.
         *
         * @param source Path of the source directory tree
         * @param destination Path of the destination directory tree
         */
        exports.copyTree = function (source, destination) {
            if (!fs._copyTree(source, destination)) {
                throw "Unable to copy directory tree '" + source + "' at '" + destination + "'";
            }
        };

        /** Move a file.
         * It will throw an exception if it fails.
         *
         * @param source Path of the source file
         * @param destination Path of the destination file
         */
        exports.move = function (source, destination) {
            fs.copy(source, destination);
            fs.remove(source);
        };

        /** Removes a file.
         * It will throw an exception if it fails.
         *
         * @param path Path of the file to remove
         */
        exports.remove = function (path) {
            if (!fs._remove(path)) {
                throw "Unable to remove file '" + path + "'";
            }
        };

        /** Removes a directory.
         * It will throw an exception if it fails.
         *
         * @param path Path of the directory to remove
         */
        exports.removeDirectory = function (path) {
            if (!fs._removeDirectory(path)) {
                throw "Unable to remove directory '" + path + "'";
            }
        };

        /** Removes a directory tree.
         * It will throw an exception if it fails.
         *
         * @param path Path of the directory tree to remove
         */
        exports.removeTree = function (path) {
            if (!fs._removeTree(path)) {
                throw "Unable to remove directory tree '" + path + "'";
            }
        };

        exports.touch = function (path) {
            fs.write(path, "", 'a');
        };

    }

    if (typeof exports === 'undefined') {
        throw 'Unknown module ' + name + ' for require()';
    }

    return exports;
}

// Legacy way to use WebPage
window.WebPage = require('webpage');
