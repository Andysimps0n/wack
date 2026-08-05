import SmashButton from "./SmashButton";
import RotateBar from "./RotateBar";

export default function WackUI({ status, onSmash, rotationY, onRotateDelta }) {
  return (
    <div className="wack-ui-wrapper">
      <SmashButton status={status} onSmash={onSmash} />
      <RotateBar rotationY={rotationY} onRotateDelta={onRotateDelta} />
    </div>
  );
}
