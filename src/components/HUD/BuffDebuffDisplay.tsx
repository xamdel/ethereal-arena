import { Buff, Debuff } from "../../models";
import BuffDebuffIcon from "./BuffDebuffIcon";

interface BuffDebuffProps {
    effects: (Buff | Debuff)[];
    isBuff: boolean;
}

const BuffDebuffDisplay: React.FC<BuffDebuffProps> = ({ effects, isBuff }) => {
    return (
        <div>
            {effects.map((effect, index) => (
                <BuffDebuffIcon key={index} effect={effect} />
            ))}
        </div>
    );
};

export default BuffDebuffDisplay;