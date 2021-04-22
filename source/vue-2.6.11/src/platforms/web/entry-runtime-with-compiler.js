/* @flow */

import config from "core/config";
import { warn, cached } from "core/util/index";
import { mark, measure } from "core/util/perf";

import Vue from "./runtime/index";
import { query } from "./util/index";
import { compileToFunctions } from "./compiler/index";
import {
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref,
} from "./util/compat";

const idToTemplate = cached((id) => {
  console.log("id==", id);
  const el = query(id);
  return el && el.innerHTML;
});

// src/platform/web/runtime/index.js
// 注意此处最终调用mountComponent方法
const mount = Vue.prototype.$mount; // 如果已经有$mount,那么获取

/***
 * @param {string|Element} el 挂载元素，字符串或者DOM对象
 * @param {boolean} hydrating 服务器渲染相关
 */
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el); // 获取对应的元素，如果没有，就创建

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    // 不允许挂载到html元素或者body元素上
    process.env.NODE_ENV !== "production" &&
      warn(
        `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
      );
    return this;
  }

  const options = this.$options; // 获取Vue类的成员方法
  // resolve template/el and convert to render function
  // 不携带渲染方法，则需要自己转换
  // 注意：所有的Vue组件的渲染最终需要render方法实现，无论使用单文件.vue方法开发组件，还是写了el或者template属性，最终将会转换为render方法
  if (!options.render) {
    // 如果没有render方法，将el或者template转换为render方法

    // 模板处理
    let template = options.template;
    if (template) {
      if (typeof template === "string") {
        // 模板是string类型，且以`#`开头
        if (template.charAt(0) === "#") {
          // 通过query方法转为DOM对象
          template = idToTemplate(template);
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== "production" && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            );
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML;
      } else {
        // 非生产环境下提示
        if (process.env.NODE_ENV !== "production") {
          warn("invalid template option:" + template, this);
        }
        return this;
      }
    } else if (el) {
      // el处理
      template = getOuterHTML(el);
    }

    // 在线编译，将el和template转为render方法
    if (template) {
      // 模板处理
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile");
      }

      // 此处开始标记
      const { render, staticRenderFns } = compileToFunctions(
        template,
        {
          outputSourceRange: process.env.NODE_ENV !== "production",
          shouldDecodeNewlines,
          shouldDecodeNewlinesForHref,
          delimiters: options.delimiters,
          comments: options.comments,
        },
        this
      );
      options.render = render;
      options.staticRenderFns = staticRenderFns;

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile end");
        measure(`vue ${this._name} compile`, "compile", "compile end");
      }
    }
  }

  // 传参入内执行，挂载$mount
  return mount.call(this, el, hydrating);
};

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML;
  } else {
    const container = document.createElement("div");
    container.appendChild(el.cloneNode(true));
    return container.innerHTML;
  }
}

Vue.compile = compileToFunctions;

export default Vue;
