# Crunchyroll Audio Helper
A helper extension/userscript to add offset to audio on the Crunchyroll streaming service. The extension is compatible with the Croptix extension. Additionally, for convenience's sake, the offset of the current episode is cached and persists through reload. 

<img alt="demo gif" src="assets/audio-ext-demo.gif" width="480"/>

## How it works
By poking the webpack code and monkey patching select functions, the extension is able to access the internal video player and source buffers of the Crunchyroll `/watch/` page. By adjusting the timestamp offset of the source buffers, the extension can apply an arbitrary offset. 

> [!NOTE]
> However, this does mean that the current buffer has to run out/be invalidated first. Because of that, there's a delay before the offset can be applied. 
 
More specifically, the extension pushes a module into the `webpackChunkbitmovin_player` chunk, then captures the require function. Afterward, a scan of the entire chunk is performed to search for two modules: the module exposing the `InternalPlayer` class, and the module exposing the `MSEWrapper` class. By monkey patching select functions in the prototype of those two classes, the extension can capture the active instances. 

After captures, the extension exposes the following in the `window` object:
1. `function __require_webpackChunkbitmovin_player` - the require function for the `webpackChunkbitmovin_player` chunk
2. `__audioExtOffset: number` - the current offset in seconds (editing this directly doesn't trigger the player reload)
3. `async function __audioExtSetOffset(offset: number)` - function to set the current `audioExtOffset`, triggers a player reload and saves the new value into `localStorage` under the key `audio-ext-delay` using the slug of the current episode 
4. `__audioExtPlayer` - the latest active instance of the `InternalPlayer` class
5. `__audioExtWrapper` - the latest active instance of the `MSEWrapper` class

Please note that it may take a few moments after opening a `/watch/` page for these variables to become populated. Additionally, these values are wiped between in page navigations.