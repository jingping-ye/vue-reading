/* @flow */

import config from "../config";
import VNode, { createEmptyVNode } from "./vnode";
import { createComponent } from "./create-component";
import { traverse } from "../observer/traverse";

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset,
} from "../util/index";

import { normalizeChildren, simpleNormalizeChildren } from "./helpers/index";

const SIMPLE_NORMALIZE = 1;
const ALWAYS_NORMALIZE = 2;

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
// 创建虚拟DOM来追踪自己是如何改变真实的DOM
// createElement返回createNodeDescription，即一个节点描述，此处叫虚拟DOM，包含信息包括，Vue页面需要渲染什么样的节点，包括及其子节点的描述信息。这样的节点成为虚拟节点(virtual node)，简写为VNode。虚拟DOM是由Vue组件树建立起来的整个VNode树的称呼
/***
 * createElement是对_createElement的封装，
 * 它允许传入的参数更加灵活，在处理这些参数后，调用真正创建 VNode 的函数 _createElement
 */
export function createElement(
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children;
    children = data;
    data = undefined;
  }
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE;
  }
  return _createElement(context, tag, data, children, normalizationType);
}

/**
 *
 * @param {Component} context  VNode 的上下文环境
 * @param {string | Class<Component> | Function | Object,} tag 标签
 * @param {VNodeData} data VNode 的数据，它是一个 VNodeData 类型,可以在 flow/vnode.js 中找到它的定义
 * @param {any} children 当前 VNode 的子节点，它是任意类型的，它接下来需要被规范为标准的 VNode 数组
 * @param {number} normalizationType 子节点规范的类型，类型不同规范的方法也就不一样，它主要是参考 render 函数是编译生成的还是用户手写的。
 * @returns
 */
export function _createElement(
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        `Avoid using observed data object as vnode data: ${JSON.stringify(
          data
        )}\n` + "Always create fresh vnode data objects in each render!",
        context
      );
    return createEmptyVNode();
  }
  // object syntax in v-bind
  if (isDef(data) && isDef(data.is)) {
    tag = data.is;
  }
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode();
  }
  // warn against non-primitive key
  if (
    process.env.NODE_ENV !== "production" &&
    isDef(data) &&
    isDef(data.key) &&
    !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !("@binding" in data.key)) {
      warn(
        "Avoid using non-primitive value as key, " +
          "use string/number value instead.",
        context
      );
    }
  }
  // support single function children as default scoped slot
  if (Array.isArray(children) && typeof children[0] === "function") {
    data = data || {};
    data.scopedSlots = { default: children[0] };
    children.length = 0;
  }

  // 规范化子节点
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children);
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children);
  }

  // 创建VNode实例
  let vnode, ns;
  if (typeof tag === "string") {
    // 如果是内置的一些节点，则直接创建一个普通 VNode
    let Ctor;
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag);
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      if (
        process.env.NODE_ENV !== "production" &&
        isDef(data) &&
        isDef(data.nativeOn)
      ) {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        );
      }
      vnode = new VNode(
        config.parsePlatformTagName(tag),
        data,
        children,
        undefined,
        undefined,
        context
      );
    } else if (
      (!data || !data.pre) &&
      isDef((Ctor = resolveAsset(context.$options, "components", tag)))
    ) {
      // 已注册的组件名，通过 createComponent 创建一个组件类型的 VNode
      // component
      vnode = createComponent(Ctor, data, context, children, tag);
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 创建一个未知的标签的 VNode。
      vnode = new VNode(tag, data, children, undefined, undefined, context);
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children);
  }
  if (Array.isArray(vnode)) {
    return vnode;
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns);
    if (isDef(data)) registerDeepBindings(data);
    return vnode;
  } else {
    return createEmptyVNode();
  }
}

function applyNS(vnode, ns, force) {
  vnode.ns = ns;
  if (vnode.tag === "foreignObject") {
    // use default namespace inside foreignObject
    ns = undefined;
    force = true;
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i];
      if (
        isDef(child.tag) &&
        (isUndef(child.ns) || (isTrue(force) && child.tag !== "svg"))
      ) {
        applyNS(child, ns, force);
      }
    }
  }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings(data) {
  if (isObject(data.style)) {
    traverse(data.style);
  }
  if (isObject(data.class)) {
    traverse(data.class);
  }
}