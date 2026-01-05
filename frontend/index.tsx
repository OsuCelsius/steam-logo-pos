import { callable, findModule, Millennium, sleep, DialogButton, IconsModule, definePlugin, Field, TextField, Toggle } from "@steambrew/client";
import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const WaitForElementTimeout = async (sel: string, parent = document, timeOut = 1000) =>
	[...(await Millennium.findElement(parent, sel, timeOut))][0];

const WaitForElementList = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))];

var pluginConfig = {
    context_menu: false,
    show_button: true
};

var posDB = {};

function get_app_x(app_id) {
    if (app_id.toString() in posDB) {
        return posDB[app_id.toString()][0];
    } else {
        return -1;
    }
}

function get_app_y(app_id) {
    if (app_id.toString() in posDB) {
        return posDB[app_id.toString()][1];
    } else {
        return -1;
    }
}

function set_app_xy(app_id, pos_x, pos_y) {
    posDB[app_id.toString()] = [pos_x, pos_y];
    localStorage.setItem("luthor112.steam-logo-pos.posdb", JSON.stringify(posDB));
}

async function OnPopupCreation(popup) {
    if (popup.m_strName === "SP Desktop_uid0") {
        
        let observer = null; // Declare observer here to hold its reference across navigations.

        var mwbm = undefined;
        while (!mwbm) {
            console.log("[steam-logo-pos] Waiting for MainWindowBrowserManager");
            try {
                mwbm = MainWindowBrowserManager;
            } catch {
                await sleep(100);
            }
        }

        MainWindowBrowserManager.m_browser.on("finished-request", async (currentURL, previousURL) => {
            if (MainWindowBrowserManager.m_lastLocation.pathname.startsWith("/library/app/")) {
                const sizerDiv = await WaitForElement(`div.${findModule(e => e.BoxSizer).BoxSizer}`, popup.m_popup.document);
                const savedX = get_app_x(uiStore.currentGameListSelection.nAppId);
                const savedY = get_app_y(uiStore.currentGameListSelection.nAppId);

                if (savedX !== -1 || savedY !== -1) {
                    sizerDiv.style.left = savedX + "px";
                    sizerDiv.style.top = savedY + "px";
                }

                const movementHandler = async () => {
                    if (!sizerDiv.classList.contains("logopos-header")) {
                        async function makeDraggableElement(elmnt) {
                            var diffX = 0, diffY = 0, lastX = 0, lastY = 0, elmntX = 0, elmntY = 0;
                            elmnt.onmousedown = dragMouseDown;
                            elmnt.style.cursor = "move";

                            async function dragMouseDown(e) {
                                e = e || window.event;
                                e.preventDefault();
                                lastX = e.clientX;
                                lastY = e.clientY;
                                popup.m_popup.document.onmouseup = elementRelease;
                                popup.m_popup.document.onmousemove = elementDrag;
                            }

                            async function elementDrag(e) {
                                e = e || window.event;
                                e.preventDefault();
                                diffX = lastX - e.clientX;
                                diffY = lastY - e.clientY;
                                lastX = e.clientX;
                                lastY = e.clientY;
                                elmntY = (elmnt.offsetTop - diffY);
                                elmntX = (elmnt.offsetLeft - diffX);
                                elmnt.style.top = elmntY + "px";
                                elmnt.style.left = elmntX + "px";
                            }

                            async function elementRelease() {
                                popup.m_popup.document.onmouseup = null;
                                popup.m_popup.document.onmousemove = null;
                                set_app_xy(uiStore.currentGameListSelection.nAppId, elmntX, elmntY);
                            }
                        }

                        makeDraggableElement(sizerDiv);
                        sizerDiv.classList.add("logopos-header");

                        const topCapsuleDiv = await WaitForElement(`div.${findModule(e => e.TopCapsule).TopCapsule}`, popup.m_popup.document);
                        const oldDoneBtn = topCapsuleDiv.querySelector("div.logo-move-done-button");
                        if (oldDoneBtn) {
                            oldDoneBtn.style.display = "";
                        } else {
                            const doneBtn = document.createElement('div');
                            doneBtn.className = "logo-move-done-button";
                            doneBtn.style.position = "absolute";
                            doneBtn.style.right = "20px";
                            doneBtn.style.bottom = "20px";
                            const doneBtnRoot = createRoot(doneBtn);
                            doneBtnRoot.render(<DialogButton style={{width: "fit-content", padding: "0px 20px"}} onClick={movementHandler}>Done</DialogButton>);
                            topCapsuleDiv.appendChild(doneBtn);
                        }
                    } else {
                        sizerDiv.onmousedown = null;
                        sizerDiv.style.cursor = "";
                        sizerDiv.classList.remove("logopos-header");

                        const topCapsuleDiv = await WaitForElement(`div.${findModule(e => e.TopCapsule).TopCapsule}`, popup.m_popup.document);
                        const oldDoneBtn = topCapsuleDiv.querySelector("div.logo-move-done-button");
                        if (oldDoneBtn) {
                            oldDoneBtn.style.display = "none";
                        }
                    }
                };

                const appButtonEnabled = pluginConfig.show_button;
                if (appButtonEnabled) {
                    const gameSettingsButton = await WaitForElement(`div.${findModule(e => e.InPage).InPage} div.${findModule(e => e.AppButtonsContainer).AppButtonsContainer} > div.${findModule(e => e.MenuButtonContainer).MenuButtonContainer}:not([role="button"])`, popup.m_popup.document);
                    const oldMoveButton = gameSettingsButton.parentNode.querySelector('div.logo-move-button');
                    
                    if (!oldMoveButton) {
                        const moveButton = gameSettingsButton.cloneNode(true);
                        moveButton.classList.add("logo-move-button");
                        moveButton.firstChild.innerHTML = "ML";
                        gameSettingsButton.parentNode.insertBefore(moveButton, gameSettingsButton.nextSibling);
                        moveButton.addEventListener("click", movementHandler);
                    }
                }

                const contextMenuEnabled = pluginConfig.context_menu;
                if (contextMenuEnabled) {

                    // Disconnect the old observer before creating a new one to prevent conflicts.
                    if (observer) {
                        observer.disconnect();
                    }

                    const hasSpecificMenuItems = (container) => {
                        // _1n7Wloe5jZ6fSuvV18NNWI == contextMenuItem
                        const itemsText = Array.from(container.querySelectorAll(`div.${findModule(e => e.ContextMenuMouseOverlay).contextMenuItem}.contextMenuItem`))
                            .map(el => el.textContent.trim());
                        // "CustomArt_EditLogoPosition":"Adjust Logo Position"
                        while (!findModule(e => e["CustomArt_EditLogoPosition"]));
                        console.log("[steam-logo-pos] CustomArt_EditLogoPosition == ", findModule(e => e["CustomArt_EditLogoPosition"])["CustomArt_EditLogoPosition"]);
                        const requiredItems = [findModule(e => e["CustomArt_EditLogoPosition"])["CustomArt_EditLogoPosition"]];
                        return requiredItems.every(item => itemsText.includes(item));
                    };

                    const addMoveLogoButton = (container) => {
                        if (!hasSpecificMenuItems(container)) return;
                        if (container.querySelector('.contextMenuItem.moveLogoAdded')) return;

                        const newItem = document.createElement('div');
                        // _1n7Wloe5jZ6fSuvV18NNWI == contextMenuItem
                        newItem.setAttribute('role', `${findModule(e => e.ContextMenuMouseOverlay).contextMenuItem}`);
                        newItem.className = `${findModule(e => e.ContextMenuMouseOverlay).contextMenuItem} contextMenuItem moveLogoAdded`;
                        newItem.textContent = 'Move Logo';
                        newItem.addEventListener('click', async () => {
                            await movementHandler();
                            const parentDiv = container.parentElement;
                            if (parentDiv) parentDiv.style.display = 'none';
                            else container.style.display = 'none';
                        });
                        container.appendChild(newItem);
                        console.log('[steam-logo-pos] "Move Logo" item successfully added');
                    };

                    // Assign to the shared observer reference.
                    observer = new MutationObserver(mutations => {
                        mutations.forEach(mutation => {
                            mutation.addedNodes.forEach(node => {
                                if (node.nodeType === 1) { // Element node
                                    // _2EstNjFIIZm_WUSKm5Wt7n == contextMenuContents
                                    const container = node.querySelector(`div.${findModule(e => e.ContextMenuMouseOverlay).contextMenuContents}`) ||
                                        (node.classList && node.classList.contains(`${findModule(e => e.ContextMenuMouseOverlay).contextMenuContents}`) ? node : null);
                                    if (container) {
                                        addMoveLogoButton(container);
                                    }
                                }
                            });
                        });
                    });

                    observer.observe(popup.m_popup.document.body, { childList: true, subtree: true });
                }
            }
        });
    }
}

const SingleSetting = (props) => {
    const [boolValue, setBoolValue] = useState(false);

    const saveConfig = () => {
        localStorage.setItem("luthor112.steam-logo-pos.config", JSON.stringify(pluginConfig));
    };

    useEffect(() => {
        if (props.type === "bool") {
            setBoolValue(pluginConfig[props.name]);
        }
    }, []);

    if (props.type === "bool") {
        return (
            <Field label={props.label} description={props.description} bottomSeparator="standard" focusable>
                <Toggle value={boolValue} onChange={(value) => { setBoolValue(value); pluginConfig[props.name] = value; saveConfig(); }} />
            </Field>
        );
    } else if (props.type === "text") {
        return (
            <Field label={props.label} description={props.description} bottomSeparator="standard" focusable>
                <TextField defaultValue={pluginConfig[props.name]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { pluginConfig[props.name] = e.currentTarget.value; saveConfig(); }} />
            </Field>
        );
    }
}

const SettingsContent = () => {
    return (
        <div>
            <SingleSetting name="context_menu" type="bool" label="Context menu option" description="Add Move Logo option to context menu" />
            <SingleSetting name="show_button" type="bool" label="Show button" description="Add ML button to applcation page" />
        </div>
    );
};

async function pluginMain() {
    console.log("[steam-logo-pos] Frontend startup");
    await App.WaitForServicesInitialized();
    await sleep(100);

    while (
        typeof g_PopupManager === 'undefined' ||
        typeof MainWindowBrowserManager === 'undefined'
    ) {
        await sleep(100);
    }

    const storedConfig = JSON.parse(localStorage.getItem("luthor112.steam-logo-pos.config"));
    pluginConfig = { ...pluginConfig, ...storedConfig };
    console.log("[steam-logo-pos] Merged config:", pluginConfig);

    const storedDB = JSON.parse(localStorage.getItem("luthor112.steam-logo-pos.posdb"));
    posDB = { ...posDB, ...storedDB };
    console.log("[steam-logo-pos] PosDB loaded");

    const doc = g_PopupManager.GetExistingPopup("SP Desktop_uid0");
	if (doc) {
		OnPopupCreation(doc);
	}

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreation);
}

export default definePlugin(async () => {
    await pluginMain();
    return {
		title: "Custom Logo Position",
		icon: <IconsModule.Settings />,
		content: <SettingsContent />,
	};
});
