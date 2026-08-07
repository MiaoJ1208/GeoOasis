import { IonResource } from "cesium";
import { nanoid } from "nanoid";
import * as Y from "yjs";

export type Asset = {
    id: string;
    name: string;
    url?: string;
    data?: string | Uint8Array;
    ion?: boolean;
};

export const defaultAsset: Asset[] = [
    {
        id: "asset-3",
        name: "road",
        url: "/road_hd/road_hd/scene.gltf"
    },
    {
        id: "asset-4",
        name: "suv",
        url: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf"
    },
    {
        id: "asset-5",
        name: "camera",
        url: "/camera/bc21bedf08ff475b9bd353ce1e4b4c34.gltf"
    },
    {
        id: "asset-7",
        name: "signs",
        url: "/signs/c280dde26e4e4a0185d791318a20008d.gltf"
    },
    {
        id: "asset-8",
        name: "truck",
        url: "/truckModel.glb"
    },
    {
        id: "asset-9",
        name: "light",
        url: "/street_light/scene.gltf"
    }
];

const importedAssetNamesToRemove = new Set(["truckModel.glb", "TJ6_2.glb"]);

export class AssetLibrary {
    public assetArray: Y.Array<Asset>;
    public urlMap: Map<string, string> = new Map();
    constructor(doc: Y.Doc) {
        this.assetArray = doc.getArray("AssetLibrary");
        this.init();
    }

    init() {
        for (const asset of defaultAsset) {
            this.urlMap.set(asset.id, asset.url as string);
        }
        const createURLhandler = this.createURLhandler.bind(this);
        this.assetArray.observe(createURLhandler);
        this.removeImportedAssetRecords();
    }

    addAsset(option: {
        name: string;
        data?: Uint8Array;
        url?: string;
        ion?: boolean;
    }) {
        const asset = {
            id: nanoid(),
            name: option.name,
            url: option.url,
            data: option.data,
            ion: option.ion
        };
        this.assetArray.push([asset]);
    }

    async getAssetUrl(
        assetId: string
    ): Promise<string | IonResource | undefined> {
        const asset = this.assetArray
            .toArray()
            .find((asset) => asset.id === assetId);
        if (asset && asset.ion) {
            const resource = await IonResource.fromAssetId(Number(asset.url));
            return resource;
        }
        return this.urlMap.get(assetId);
    }

    getAssetId(index: number): string | undefined {
        let assetId;
        if (index < defaultAsset.length) {
            assetId = defaultAsset[index].id;
        } else {
            assetId = this.assetArray.get(index - defaultAsset.length).id;
        }
        return assetId;
    }

    createURLhandler(
        _events: Y.YArrayEvent<Asset>,
        _transactions: Y.Transaction
    ) {
        this.removeImportedAssetRecords();
        this.assetArray.forEach((asset) => {
            if (!this.urlMap.has(asset.id)) {
                if (asset.data && asset.data instanceof Uint8Array) {
                    const glbBlob = new Blob([asset.data], {
                        type: "model/gltf-binary"
                    });
                    const uri = URL.createObjectURL(glbBlob);
                    this.urlMap.set(asset.id, uri);
                } else if (asset.url) {
                    this.urlMap.set(asset.id, asset.url);
                }
            }
        });
    }

    private removeImportedAssetRecords() {
        for (let index = this.assetArray.length - 1; index >= 0; index--) {
            const asset = this.assetArray.get(index);
            if (importedAssetNamesToRemove.has(asset.name)) {
                const url = this.urlMap.get(asset.id);
                if (url?.startsWith("blob:")) {
                    URL.revokeObjectURL(url);
                }
                this.urlMap.delete(asset.id);
                this.assetArray.delete(index, 1);
            }
        }
    }
}
