import System from '../System';
import { settings } from '../settings';
import { ENV } from '@pixi/constants';

let CONTEXT_UID = 0;

/**
 * @class
 * @extends PIXI.System
 * @memberof PIXI.systems
 */
export default class ContextSystem extends System
{
    /**
     * @param {PIXI.Renderer} renderer - The renderer this System works for.
     */
    constructor(renderer)
    {
        super(renderer);

        /**
         * Either 1 or 2 to reflect the WebGL version being used
         * @member {number}
         * @readonly
         */
        this.webGLVersion = 1;

        /**
         * Extensions being used
         * @member {object}
         * @readonly
         * @property {WEBGL_draw_buffers} drawBuffers - WebGL v1 extension
         * @property {WEBKIT_WEBGL_depth_texture} depthTexture - WebGL v1 extension
         * @property {OES_texture_float} floatTexture - WebGL v1 extension
         * @property {WEBGL_lose_context} loseContext - WebGL v1 extension
         * @property {OES_vertex_array_object} vertexArrayObject - WebGL v1 extension
         */
        this.extensions = {};

        // Bind functions
        this.handleContextLost = this.handleContextLost.bind(this);
        this.handleContextRestored = this.handleContextRestored.bind(this);

        renderer.view.addEventListener('webglcontextlost', this.handleContextLost, false);
        renderer.view.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    }

    /**
     * `true` if the context is lost
     * @member {boolean}
     * @readonly
     */
    get isLost()
    {
        return (!this.gl || this.gl.isContextLost());
    }

    /**
     * Handle the context change event
     */
    contextChange(gl)
    {
        this.gl = gl;

        // restore a context if it was previously lost
        if (gl.isContextLost() && gl.getExtension('WEBGL_lose_context'))
        {
            gl.getExtension('WEBGL_lose_context').restoreContext();
        }
    }

    /**
     * Initialize the context
     *
     * @private
     * @param {WebGLRenderingContext} gl - WebGL context
     */
    initFromContext(gl)
    {
        this.gl = gl;
        this.validateContext(gl);
        this.renderer.gl = gl;
        this.renderer.CONTEXT_UID = CONTEXT_UID++;
        this.renderer.runners.contextChange.run(gl);
    }

    /**
     * Initialize from context options
     *
     * @private
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
     * @param {object} options - context attributes
     */
    initFromOptions(options)
    {
        const gl = this.createContext(this.renderer.view, options);

        this.initFromContext(gl);
    }

    /**
     * Helper class to create a webGL Context
     *
     * @param canvas {HTMLCanvasElement} the canvas element that we will get the context from
     * @param options {object} An options object that gets passed in to the canvas element containing the context attributes
     * @see https://developer.mozilla.org/en/docs/Web/API/HTMLCanvasElement/getContext
     * @return {WebGLRenderingContext} the WebGL context
     */
    createContext(canvas, options)
    {
        let gl;

        if (settings.PREFER_ENV >= ENV.WEBGL2)
        {
            gl = canvas.getContext('webgl2', options);
        }

        if (gl)
        {
            this.webGLVersion = 2;
        }
        else
        {
            this.webGLVersion = 1;

            gl = canvas.getContext('webgl', options)
            || canvas.getContext('experimental-webgl', options);

            if (!gl)
            {
                // fail, not able to get a context
                throw new Error('This browser does not support webGL. Try using the canvas renderer');
            }
        }

        this.gl = gl;

        this.getExtensions();

        return gl;
    }

    /**
     * Auto-populate the extensions
     *
     * @private
     */
    getExtensions()
    {
        // time to set up default extensions that pixi uses..
        const { gl } = this;

        if (this.webGLVersion === 1)
        {
            Object.assign(this.extensions, {
                drawBuffers: gl.getExtension('WEBGL_draw_buffers'),
                depthTexture: gl.getExtension('WEBKIT_WEBGL_depth_texture'),
                floatTexture: gl.getExtension('OES_texture_float'),
                loseContext: gl.getExtension('WEBGL_lose_context'),
                vertexArrayObject: gl.getExtension('OES_vertex_array_object')
                    || gl.getExtension('MOZ_OES_vertex_array_object')
                    || gl.getExtension('WEBKIT_OES_vertex_array_object'),
            });
        }

        // we don't use any specific WebGL 2 ones yet!
    }

    /**
     * Handles a lost webgl context
     *
     * @private
     * @param {WebGLContextEvent} event - The context lost event.
     */
    handleContextLost(event)
    {
        event.preventDefault();
    }

    /**
     * Handles a restored webgl context
     *
     * @private
     */
    handleContextRestored()
    {
        this.renderer.runners.contextChange.run(this.gl);
    }

    destroy()
    {
        const view = this.renderer.view;

        // remove listeners
        view.removeEventListener('webglcontextlost', this.handleContextLost);
        view.removeEventListener('webglcontextrestored', this.handleContextRestored);

        this.gl.useProgram(null);

        if (this.extensions.loseContext)
        {
            this.extensions.loseContext.loseContext();
        }
    }

    /**
     * Handle the post-render runner event
     *
     * @private
     */
    postrender()
    {
        this.gl.flush();
    }

    /**
     * Validate context
     *
     * @private
     * @param {WebGLRenderingContext} gl - Render context
     */
    validateContext(gl)
    {
        const attributes = gl.getContextAttributes();

        // this is going to be fairly simple for now.. but at least we have room to grow!
        if (!attributes.stencil)
        {
            /* eslint-disable max-len */

            /* eslint-disable no-console */
            console.warn('Provided WebGL context does not have a stencil buffer, masks may not render correctly');
            /* eslint-enable no-console */

            /* eslint-enable max-len */
        }
    }
}