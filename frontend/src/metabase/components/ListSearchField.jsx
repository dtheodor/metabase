import React, { Component, PropTypes } from "react";

import Icon from "metabase/components/Icon.jsx";
import LoadingSpinner from "metabase/components/LoadingSpinner";


export default class ListSearchField extends Component {

    static propTypes = {
        onChange: PropTypes.func.isRequired,
        placeholder: PropTypes.string,
        searchText: PropTypes.string,
        autoFocus: PropTypes.bool,
        inProgress: PropTypes.bool
    };

    static defaultProps = {
        className: "bordered rounded text-grey-2 flex flex-full align-center",
        inputClassName: "p1 h4 input--borderless text-default flex-full",
        placeholder: "Find...",
        searchText: "",
        autoFocus: false,
        inProgress: false
    };

    render() {
        const { className, inputClassName, onChange, placeholder, searchText, autoFocus, inProgress } = this.props;

        return (
            <div className={className}>
                <span className="px1">                    
                  {inProgress ? (
                    <LoadingSpinner size={16}/>
                  ) : (
                    <Icon name="search" size={16}/>
                  )}
                </span>

                <input
                    className={inputClassName}
                    type="text"
                    placeholder={placeholder}
                    value={searchText}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus={autoFocus}
                />
            </div>
        );
    }
}
