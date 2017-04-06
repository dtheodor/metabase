/* @flow */
/* eslint "react/prop-types": "warn" */

import React, { Component, PropTypes } from "react";
import ReactDOM from "react-dom";
import { connect } from "react-redux";

import Popover from "metabase/components/Popover";

import { createMultiwordSearchRegex } from "metabase/lib/string";

import { MetabaseApi } from "metabase/services";
import { defer } from "metabase/lib/promise";
import { debounce } from "underscore";
import { getMetadata } from "metabase/dashboard/selectors";

import type { StructuredDatasetQuery } from "metabase/meta/types/Card";
import type { FieldId } from "metabase/meta/types/Field";

import Metadata from "metabase/meta/metadata/Metadata";

import ListSearchField from "metabase/components/ListSearchField.jsx";


const MAX_SEARCH_RESULTS = 100;

type Props = {
    value: any,
    values: any[],
    fieldId: FieldId,
    setValue: () => void,
    onClose: () => void
}
type State = {
    searchText: string,
    searchRegex: ?RegExp,
    fetchedValues: ?mixed[],
    searchInProgress: boolean
}

const mapStateToProps = (state, props) => ({
    metadata: getMetadata(state, props)
});

const entityNameCache = {};
function setEntityName(fieldId, entityId, entityName) {
    entityNameCache[fieldId] = entityNameCache[fieldId] || {};
    entityNameCache[fieldId][entityId] = entityName;
}
function getEntityName(fieldId, entityId) {
    return entityNameCache[fieldId] && entityNameCache[fieldId][entityId];
}

@connect(mapStateToProps)
export default class CategoryWidget extends Component<*, Props, State> {
    props: Props;
    state: State;


    constructor(props: Props) {
        super(props);

        this.cancelDeferred = null
        this._input = null

        this.state = {
            searchText: "",
            searchRegex: null,
            fetchedValues: null,
            searchInProgress: false
        };
    }

    static propTypes = {
        value: PropTypes.any,
        values: PropTypes.array.isRequired,
        setValue: PropTypes.func.isRequired,
        onClose: PropTypes.func.isRequired
    };

    updateSearchText = (value: string) => {
        let regex = null;

        if (value) {
            regex = createMultiwordSearchRegex(value);
        }

        this.setState({
            searchText: value,
            searchRegex: regex
        });

        if (this.props.fieldId) {
            this._updateSearch(value)
        }        
    }

    static format(value) {
        return value;
    }

    _updateSearch(value: string) {
        this._cancelSearch();
        this.setState({
            value: value,
            searchInProgress: true
        }, this._searchAndUpdateInProgress);
    }

    _searchAndUpdateInProgress = debounce(() => {
        var promise = this._search();

        promise.then((data) => {
            this.setState({...data, searchInProgress: false});
        }).catch((error) => {
            console.error(error);
            this.setState({searchInProgress: false});
        });
    }, 500)

    _cancelSearch = () => {
        // XXX: we should be cancelling the debounce here as well,
        // but underscore provides no such method
        if (this.cancelDeferred) {
            this.cancelDeferred.resolve();
        }
    }

    _search = (async (): void => {
        const { metadata, fieldId } = this.props;
        const { value, lastValue, fetchedValues } = this.state;
        const values = fetchedValues;

        // if this search is just an extension of the previous search, and the previous search
        // wasn't truncated, then we don't need to do another search because TypeaheadListing
        // will filter the previous result client-side
        if (lastValue && value.slice(0, lastValue.length) === lastValue &&
            values.length < MAX_SEARCH_RESULTS
        ) {
            return;
        }

        const valueField = metadata.field(fieldId);
        if (!valueField) {
            return;
        }

        const table = valueField.table();
        if (!table) {
            return;
        }

        const database = table.database();
        if (!database) {
            return;
        }

        const isEntityId = valueField.isID();

        let nameField;
        if (isEntityId) {
            // assumes there is only one entity name field
            nameField = table.fields().filter(f => f.isEntityName())[0];
        } else {
            nameField = valueField;
        }

        if (!nameField) {
            return;
        }

        const datasetQuery: StructuredDatasetQuery = {
            database: database.id,
            type: "query",
            query: {
                source_table: table.id,
                filter: value ? ["contains",["field-id", nameField.id], value] : ["not-null", ["field-id", nameField.id]],
                breakout: [["field-id", valueField.id]],
                // order_by: [[["field-id", nameField.id], "ascending"]],
                fields: [
                    ["field-id", valueField.id],
                    ["field-id", nameField.id]
                ],
                limit: MAX_SEARCH_RESULTS,
            }
        }

        this.cancelDeferred = defer();
        let result = await MetabaseApi.dataset(datasetQuery, { cancelled: this.cancelDeferred.promise });
        this.cancelDeferred = null;

        if (result && result.data && result.data.rows) {
            if (isEntityId) {
                for (const [entityId, entityName] of result.data.rows) {
                    setEntityName(fieldId, entityId, entityName)
                }
            }
            return {
                fetchedValues: result.data.rows,
                lastValue: value
            };
        }
    })

    componentWillUnmount() {
        this._cancelSearch()
    }

    componentDidMount() {
        this.updateSearchText(this.props.value);
    }

    render() {
        let { values: valuesProp, setValue, onClose } = this.props;
        valuesProp = valuesProp.map((str) => [str, str])
        const values = this.state.fetchedValues || valuesProp;

        // let filteredValues = [];
        // let regex = this.state.searchRegex;

        // if (regex) {
        //     for (const value of values) {
        //         if (regex.test(value[0])) {
        //             filteredValues.push(value);
        //         }
        //     }
        // } else {
        //     filteredValues = values.slice();
        // }
        // console.log({regex, filteredValues});
        let filteredValues = values;

        //         <ul className="scroll-y scroll-show" style={{ maxHeight: 300 }}>
        //             {filteredValues.map(value =>
        //                 <li
        //                     key={value}
        //                     className="px2 py1 bg-brand-hover text-white-hover cursor-pointer"
        //                     onClick={() => { setValue(value); onClose(); }}
        //                 >
        //                     {value}
        //                 </li>
        //              )}
        //         </ul>

        // ref={i => this._input = i}

                        //this.setState({ suggestions: [] });
                        //if (this._input) {
                        //    ReactDOM.findDOMNode(this._input).blur();
                        //}

        return (
            <div style={{ maxWidth: 200 }}>
                { values.length > -1 &&
                  <div className="p1">
                      <ListSearchField
                          
                          onChange={this.updateSearchText}
                          searchText={this.state.searchText}
                          autoFocus={true}
                          inProgress={this.state.searchInProgress}
                      />
                  </div>
                }
                <TypeaheadPopover
                    value={this.state.searchText}
                    options={filteredValues}
                    suggestions={filteredValues}
                    onSuggestionAccepted={(suggestion) => {
                        setValue(suggestion[0]);

                        onClose();
                    }}
                />
            </div>
        );
    }
}


import Typeahead from "metabase/hoc/Typeahead";
import cx from "classnames";

const TypeaheadPopover = Typeahead({
    optionFilter: (value, option) => {
        return value ? option[1].toLowerCase().indexOf(value.toLowerCase()) >= 0 : true;
    },
    showAllOnUnfiltered: true,
    optionIsEqual: ([idA], [idB]) => idA === idB
}) (({ value, suggestions, onSuggestionAccepted, selectedSuggestion }) => {

    if (!suggestions || !suggestions.length) {
        return null;
    }

    var suggestionIndexes = suggestions.map((s) => {
        var pos = value ? s[1].toLowerCase().indexOf(value.toLowerCase()) : null;
        var endPos = (pos != null && pos != -1) ? pos + value.length : null;
        return {
            'id': s[0],
            'name': s[1],
            'startPos': pos,
            'endPos': endPos
        }
    })

    return <ul className="scroll-y scroll-show" style={{ maxHeight: 300 }}>
            { suggestionIndexes.map(suggestion =>
                <li
                    key={suggestion.id}
                    className={cx("bg-brand-hover text-white-hover p1 px2 cursor-pointer", {
                        "bg-brand text-white": selectedSuggestion && suggestion.id === selectedSuggestion.id
                    })}
                    onClick={() => {
                        onSuggestionAccepted([suggestion.id, suggestion.name])
                    }}
                >
                  {value ? (
                    <span>
                        <span>{suggestion.name.slice(0, suggestion.startPos)}</span>
                        <span className="text-bold">{suggestion.name.slice(suggestion.startPos, suggestion.endPos)}</span>
                        <span>{suggestion.name.slice(suggestion.endPos)}</span>
                    </span>
                  ) : (
                    <span>{suggestion.name}</span>
                )}

                    { suggestion.id !== suggestion.name &&
                        <span className="ml4 float-right text-bold text-grey-2">{suggestion.id}</span>
                    }
                </li>
            )}
            </ul>

}
)
