import { IoTDevice } from "@entities/iot-device.entity";
import { Injectable, Logger } from "@nestjs/common";
import { Copy, ExternalCopy, Isolate } from "isolated-vm";

@Injectable()
export class PayloadDecoderExecutorService {
    private readonly logger = new Logger(PayloadDecoderExecutorService.name);

    allUntrustedCodeWithJsonStrings(code: string, iotDeviceString: string, rawPayloadString: string): string {
        const iotDevice = JSON.parse(iotDeviceString);
        const rawPayload = JSON.parse(rawPayloadString);
        const parsedCode = JSON.parse(code);

        return this.callUntrustedCode(parsedCode, iotDevice, rawPayload);
    }

    callUntrustedCode(code: string, iotDevice: IoTDevice | any, rawPayload: JSON): string {
        const isolate = new Isolate();
        const context = isolate.createContextSync();
        const jail = context.global;

        jail.setSync("global", jail.derefInto());

        //Isolated can not read atob. Therefore change to Buffer.From()
        jail.setSync("atob", function (str: string): Copy<string> {
            return new ExternalCopy(Buffer.from(str, "base64").toString("binary")).copyInto();
        });
        jail.setSync("innerIotDevice", new ExternalCopy(iotDevice).copyInto());
        jail.setSync("innerPayload", new ExternalCopy(rawPayload).copyInto());
        jail.setSync("reply", function (result: object) {
            return new ExternalCopy(result);
        });

        const callingCode = `\n\nconst res = decode(innerPayload, innerIotDevice); \n reply(res);`;
        const combinedCode = code + callingCode;

        const result: ExternalCopy = context.evalSync(combinedCode);
        return JSON.stringify(result.copy());
    }
}
