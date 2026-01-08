import React from "react";
import Button from "../../atoms/AuthButton";
import "./TogglePanel.css";

interface TogglePanelProps {
  logo: string;
  title: string;
  description: string;
  buttonText: string;
  onButtonClick: () => void;
  position: "left" | "right";
}

const TogglePanel: React.FC<TogglePanelProps> = ({ 
  logo, 
  title, 
  description, 
  buttonText, 
  onButtonClick, 
  position 
}) => {
  return (
    <div className={`toggle-panel toggle-${position}`}>
      <img src={logo} alt="logo" width={150} />
      <h1>{title}</h1>
      <p>{description}</p>
      <Button onClick={onButtonClick} variant="secondary" type="button">
        {buttonText}
      </Button>
    </div>
  );
};

export default TogglePanel;