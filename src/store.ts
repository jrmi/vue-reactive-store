// eslint-disable-next-line no-unused-vars
import Vue, { ComputedOptions, WatchOptionsWithHandler, WatchHandler } from 'vue'

// eslint-disable-next-line no-unused-vars
import { VRS, VRSHooks } from './typings'

import { hookWrapper } from './wrapper'

/**
 * Vue Reactive Store,
 * based on VueJS reactivity system.
 * Inspired by VueX and Vue.js instance.
 */
export class VueReactiveStore implements VRS {
  /**
   * Global hooks, called each time :
   * * an action is trigerred (before / after hooks)
   * * a property of the state is mutated (after hook)
   * * a computed property has been recomputed (after hook)
   * * a prop property has changed (after hook, mutated out of the store himself)
   * * a watch triger has been trigerred (after hook)
   */
  static globalHooks: VRSHooks[] = [];

  name = '';
  _vm: any;
  state: {
    [name: string]: any,
  } = {}
  actions: {
    [name: string]: Function
  } = {}
  computed: {
    [name: string]: (() => any) | ComputedOptions<any>
  } = {}
  watch: Record<string, string | WatchOptionsWithHandler<any> | WatchHandler<any>> = {}
  hooks: VRSHooks = {}
  modules: {
    [name: string]: VRS
  } = {}

  /**
   * Reactive store based on VueJS reactivity system
   *
   * @param {VRS} store
   * The store, composed of :
   * * name
   * * state
   * * computed properties
   * * actions potentially async
   * * watchers
   * * modules, aka sub-stores (wip)
   * * hooks that could be trigerred before / after store evolution
   */
  constructor (store: VRS) {
    this.name = store.name
    this.state = store.state
    this.computed = store.computed || {}
    this.actions = store.actions || {}
    this.hooks = store.hooks || {}
    this.modules = store.modules || {}

    // check if each module doesn't exist in store state
    // or in a computed property
    // to correctly namespace them
    Object.keys(this.modules).forEach((moduleName) => {
      if (this.state[moduleName] !== null) {
        const errorMessage = `
          You're trying to add a module which its name already exist as a state property.
          Please rename your module or your state property.
          (Store ${this.name}, property/module ${moduleName})
        `
        throw new Error(errorMessage)
      }
      if (this.computed[moduleName]) {
        const errorMessage = `
          You're trying to add a module which its name already exist as a computed property.
          Please rename your module or your computed property.
          (Store ${this.name}, computed/module ${moduleName})
        `
        throw new Error(errorMessage)
      }
    })

    // wrap each action function to be catch when called
    // filter global hooks
    const actionsHooks = VueReactiveStore.globalHooks.map((hook: VRSHooks) => ({
      ...hook.actions
    }))
    // and add the 'local' hook if available
    actionsHooks.push({
      before: (this.hooks && this.hooks.actions && this.hooks.actions.before),
      after: (this.hooks && this.hooks.actions && this.hooks.actions.after)
    })
    Object.keys(this.actions || {}).forEach((key) => {
      this.actions[key] = hookWrapper(
        this.name,
        this.state,
        key,
        this.actions[key],
        actionsHooks
      )
    })

    // create a Vue instance
    // to use the VueJS reactivity system
    this._vm = new Vue({
      data: store.state,
      computed: store.computed,
      watch: store.watch
    })

    // listen to state mutations of current store
    // doesn't work for sub stores
    Object.keys(this.state).forEach((key) => {
      this._vm.$watch(key, (newValue: any, oldValue: any) => {
        // call global hooks in order
        VueReactiveStore.globalHooks.forEach((hook) => {
          if (hook.state && hook.state.after) {
            hook.state.after(this.name, key, newValue, oldValue)
          }
        })
      }, {
        deep: true
      })
    })

    // listen to computed properties recomputed
    // idem, doesn't work for sub stores
    Object.keys(this.computed).forEach((key) => {
      this._vm.$watch(key, (newValue: any, oldValue: any) => {
        // call global hooks in order
        VueReactiveStore.globalHooks.forEach((hook) => {
          if (hook.computed && hook.computed.after) {
            hook.computed.after(this.name, key, newValue, oldValue)
          }
        })
      }, {
        deep: true
      })
    })
  }
}
