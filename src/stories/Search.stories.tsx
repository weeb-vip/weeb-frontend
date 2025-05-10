import type {Meta, StoryObj} from '@storybook/react';
import {MemoryRouter} from "react-router";

import Search, {ISearch} from "../components/Search";
import {searchResult, searchResults} from "../services/api/search";
import api from "../services/api";
import React, {Suspense, useEffect, useState} from "react";
import configApi from "../services/api/config";
import Autocomplete from "../components/Autocomplete";


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Example/Search',
  component: Autocomplete,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },
  decorators: [(Story) => {
    const [loaded, setLoaded] = useState(false)
    useEffect(() => {
      configApi.fetch().then((conf) => {
        // @ts-ignore
        global.config = conf
        setLoaded(true)
      })
    }, [])
    if (loaded) {
      return (
        <Suspense fallback={<div>Loading...</div>}>
          <MemoryRouter>
            <Story/>
          </MemoryRouter>
        </Suspense>
      ) as any
    }
    return null
  }
  ]

} satisfies Meta<typeof Autocomplete>;

export default meta;
type Story = StoryObj<typeof meta>;


// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary: { args: any } = {
  args: {}
};

