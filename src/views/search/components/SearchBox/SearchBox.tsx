import {useState} from "react";
import Button, {ButtonColor} from "../../../../components/Button";

interface SearchBoxProps {
  callback: (value: string) => void;
  defaultValue?: string;
  className?: string;
}

function SearchBox({ callback, defaultValue, className }: SearchBoxProps) {
  const [value, setValue] = useState(defaultValue || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    callback(value);
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <input type="text" value={value} onChange={handleChange} className={"px-4 rounded-full p-1 w-full outline-none border border-gray-200 focus:border-gray-400 active:border-gray-400"}/>
      <Button color={ButtonColor.blue} showLabel={true} type={"submit"} label={"Search"} onClick={() =>{}}/>
    </form>

  )
}

export { SearchBox as default}
export type { SearchBoxProps }